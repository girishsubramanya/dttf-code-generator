"""
DTTF Test Case Generator
Designed and Implemented by: Girish Subramanya <girish.subramanya@daimlertruck.com>
Date: 2025-12-23
Version: 1
"""
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
import json
import os
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from parser_utils import parse_robot_content
import users

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production'

# Initialize database
users.init_db()
users.seed_admin()

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return users.User.get(user_id)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = users.verify_user(username, password)
        if user:
            if user.is_approved:
                login_user(user)
                return redirect(url_for('index'))
            else:
                flash('Your account is pending approval.')
        else:
            flash('Invalid username or password')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if users.User.get_by_username(username):
            flash('Username already exists.')
        else:
            if users.add_user(username, password):
                flash('Registration successful. Please wait for admin approval.')
                return redirect(url_for('login'))
            else:
                flash('Registration failed.')
    return render_template('register.html')

@app.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        flash('Access denied.')
        return redirect(url_for('index'))
    all_users = users.get_all_users()
    return render_template('admin.html', users=all_users)

@app.route('/admin/approve/<int:user_id>', methods=['POST'])
@login_required
def approve_user_route(user_id):
    if not current_user.is_admin:
        return redirect(url_for('index'))
    users.approve_user(user_id)
    flash('User approved.')
    return redirect(url_for('admin'))

@app.route('/admin/reject/<int:user_id>', methods=['POST'])
@login_required
def reject_user_route(user_id):
    if not current_user.is_admin:
        return redirect(url_for('index'))
    users.delete_user(user_id)
    flash('User rejected/deleted.')
    return redirect(url_for('admin'))

@app.route('/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    if request.method == 'POST':
        old_password = request.form['old_password']
        new_password = request.form['new_password']
        confirm_password = request.form['confirm_password']

        if not users.verify_user(current_user.username, old_password):
            flash('Incorrect old password.')
        elif new_password != confirm_password:
            flash('New passwords do not match.')
        else:
            users.update_password(current_user.id, new_password)
            flash('Password updated successfully.')
            return redirect(url_for('index'))
    return render_template('change_password.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    robot_config = []
    try:
        config_path = os.path.join(os.path.dirname(__file__), 'robot_config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                robot_config = json.load(f)
    except Exception as e:
        print(f"Error loading DTTF config: {e}")

    return render_template('index.html', robot_config=robot_config)

@app.route('/upload', methods=['POST'])
@login_required
def upload_robot():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        try:
            content = file.read().decode('utf-8')
            parsed_data = parse_robot_content(content)
            return jsonify(parsed_data)
        except Exception as e:
            print(f"Error parsing file: {e}")
            return jsonify({'error': str(e)}), 500

@app.route('/generate', methods=['POST'])
@login_required
def generate_robot():
    data = request.json

    settings_block = data.get('settings', '')
    test_cases = data.get('testCases', [])
    # variables is now a list of objects or empty string if legacy
    variables_list = data.get('variables', [])

    output = []

    # Settings Section
    if settings_block and settings_block.strip():
        # Check if user already included the header
        lines = settings_block.strip().splitlines()
        first_line_clean = lines[0].strip().lower() if lines else ""

        if first_line_clean.startswith("*** settings ***"):
            output.append(settings_block.strip())
        else:
            output.append("*** Settings ***")
            output.append(settings_block.strip())
        output.append("")

    # Variables Section
    if isinstance(variables_list, list) and len(variables_list) > 0:
        output.append("*** Variables ***")
        for var in variables_list:
            name = var.get('name', '')
            val_raw = var.get('value', '')
            var_type = var.get('type', 'Scalar')

            # Format value
            # Split by newlines to handle multiple items/lines
            val_lines = [v.strip() for v in val_raw.split('\n') if v.strip()]
            val_str = "    ".join(val_lines)

            if var_type == 'Scalar':
                output.append(f"${{{name}}}    {val_str}")
            elif var_type == 'List':
                output.append(f"@{{{name}}}    {val_str}")
            elif var_type == 'Dictionary':
                output.append(f"&{{{name}}}    {val_str}")
        output.append("")
    elif isinstance(variables_list, str) and variables_list.strip():
        # Legacy/Fallback if it were a string block
        output.append("*** Variables ***")
        output.append(variables_list.strip())
        output.append("")

    # Test Cases Section
    output.append("*** Test Cases ***")

    for tc in test_cases:
        output.append(tc['name'])
        if 'doc' in tc and tc['doc']:
            output.append(f"    [Documentation]    {tc['doc']}")

        if 'tags' in tc and tc['tags']:
            tags_str = "    ".join(tc['tags'])
            output.append(f"    [Tags]    {tags_str}")

        if 'setup' in tc and tc['setup']:
            output.append(f"    [Setup]    {tc['setup']}")

        indent_level = 1
        for step in tc['steps']:
            step_name = step['name'].upper()

            # Decrease indent before printing for END, ELSE, ELSE IF, EXCEPT, FINALLY
            current_indent = indent_level
            if step_name == 'END':
                indent_level -= 1
                current_indent = indent_level
            elif step_name in ['ELSE', 'ELSE IF', 'EXCEPT', 'FINALLY']:
                current_indent = indent_level - 1

            if current_indent < 1:
                current_indent = 1

            indent_str = "    " * current_indent
            line = f"{indent_str}{step['name']}"

            if 'args' in step and isinstance(step['args'], list):
                for arg in step['args']:
                    value = arg.get('value', '')
                    line += f"    {value}"
            output.append(line)

            # Increase indent after printing for block starters
            if step_name in ['IF', 'FOR', 'WHILE', 'TRY']:
                indent_level += 1

        if 'teardown' in tc and tc['teardown']:
            output.append(f"    [Teardown]    {tc['teardown']}")
        output.append("")

    final_output = "\n".join(output)
    return jsonify({'robot': final_output})

if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible from outside the container
    # Disable debug mode for production/container use
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    port = int(os.environ.get('PORT', 5005))
    app.run(debug=debug_mode, host='0.0.0.0', port=port)
