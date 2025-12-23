# DTTF Test Case Generator

A web-based tool for creating DTTF Framework test cases using a drag-and-drop interface.

## Metadata
- **Designed and Implemented by**: Girish Subramanya <girish.subramanya@daimlertruck.com>
- **Date**: 2025-12-23
- **Version**: 1

## Features

- **Drag and Drop**: Create test cases by dragging keywords from a customizable library.
- **Tree View**: Organize keywords into nested categories and groups.
- **Configuration**: Define your keywords and their arguments in `robot_config.json`.
- **Properties Editor**: Edit arguments for each keyword step.
- **Import**: Upload existing `.robot` files to edit in the GUI.
- **Generation**: Preview and download the generated `.robot` file.

## Setup

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Run the Application**:
    ```bash
    python app.py
    ```

3.  **Access**:
    Open your browser to `http://127.0.0.1:5000`, for local run

## Deployment

A GitHub Actions workflow is provided in `.github/workflows/deploy.yml`.
This workflow is configured to deploy the application to a self-hosted runner (icd-dashboard) whenever changes are pushed to the `main` branch.

**Workflow Steps:**
1.  Checkout code on the runner.
2.  Stop any existing instance of the application (`python app.py`).
3.  Install dependencies from `requirements.txt`.
4.  Start the application in the background.

## Configuration

The keywords available in the toolbox are defined in `robot_config.json`. The structure supports nested categories.

**Example `robot_config.json`:**

```json
{
  "category": "Diagnostics",
  "keywords": [
    {
      "name": "get_diag_response_req_via_bytes",
      "doc": "Sends raw UDS request & returns response. Example: 22 F1 90",
      "args": [
        {
          "name": "diagnostic_request",
          "default": ""
        }
      ]
    },
    {
      "name": "send_diag_req_via_bytes",
      "doc": "Sends raw UDS request. Example: 22 F1 91",
      "args": [
        {
          "name": "diagnostic_request",
          "default": ""
        }
      ]
    },
    {
      "name": "send_diag_req_via_qualifier",
      "doc": "Sends UDS request using qualifier name. Example: Default_Start",
      "args": [
        {
          "name": "diagnostic_request",
          "default": ""
        }
      ]
    },
    {
      "name": "send_diag_req_via_bytes_validate",
      "doc": "Sends structured request expecting positive response. Example: Request=10 01, Data=50 01 02 01 01",
      "args": [
        {
          "name": "diagnostic_request",
          "default": ""
        },
        {
          "name": "expected_data",
          "default": ""
        }
      ]
    },
    {
      "name": "send_diag_req_via_id_validate",
      "doc": "Sends structured ID request expecting positive response. Example: Default_Start",
      "args": [
        {
          "name": "diagnostic_request",
          "default": ""
        },
        {
          "name": "expected_data",
          "default": ""
        }
      ]
    },
    {
      "name": "send_req_via_bytes_expect_nrc",
      "doc": "Sends request expecting NRC negative response. Example: 7F 2E 33",
      "args": [
        {
          "name": "diagnostic_request",
          "default": ""
        },
        {
          "name": "expected_data",
          "default": ""
        }
      ]
    },
    {
      "name": "send_req_via_id_expect_nrc",
      "doc": "Sends ID request expecting NRC. Example: Write_memory",
      "args": [
        {
          "name": "diagnostic_request",
          "default": ""
        },
        {
          "name": "expected_data",
          "default": ""
        }
      ]
    },
    {
      "name": "send_req_via_bytes_expect_nr",
      "doc": "Sends request expecting no response. Example: 3E 00",
      "args": [
        {
          "name": "diagnostic_request",
          "default": ""
        }
      ]
    },
    {
      "name": "send_req_via_id_expect_nr",
      "doc": "Sends ID request expecting no response. Example: Tester_Present",
      "args": [
        {
          "name": "diagnostic_request",
          "default": ""
        }
      ]
    },
    {
      "name": "req_bytes_verify_dtc_triggered",
      "doc": "Verifies DTC from bytes request. Example: 19 02 FF",
      "args": [
        {
          "name": "in_request",
          "default": ""
        },
        {
          "name": "expected_dtc",
          "default": ""
        }
      ]
    }
  ]
}
```

- **category**: Name of the group.
- **subcategories**: List of nested category objects.
- **keywords**: List of keyword objects.
- **args**: List of argument objects, each with a `name` and `default` value. Arguments are positional in the generated output.

## Usage

1.  **Tabs**: Switch between "Design" mode and "Import" mode.
2.  **Import**: Upload a `.robot` file to populate the interface.
3.  **Settings**: Enter your library imports and variable definitions.
4.  **Create Test Case**: Drag "New Test Case" from the toolbox to the canvas.
5.  **Add Steps**: Expand the keyword tree and drag keywords into the "Steps" area of a test case.
6.  **Edit Arguments**: Click on a step to view and edit its arguments in the "Properties" panel.
7.  **Reorder**: Use the arrow buttons to reorder steps or test cases.
8.  **Generate**: Click "Generate Robot File" to preview the code.
9.  **Download**: Click "Download" to save the `.robot` file.

## Testing

Run the unit tests:
```bash
python -m unittest test_app.py
```
## Environment permission Issues in Self Hosted runners

**Docker Permissions** : There are cases where Docker will run as a root user. The CI pipeline itself cannot run the docker commands from actions due to permission issues.

Follow the below commands, which may solve this issue. I faced similar issue and resolved the after providing the permission for the docker to run from all users. Ideally this is not a right approach as it opens the poermission to all users for having access to docker. Till we find a right way, this will be a workaround.

```bash
docker --version
```

## Server

**gunicorn** production server is used to run inside the docker container


if docker is installed you should see the below commands
```bash
Docker version 28.0.2, build 0442a73
```

Use the following command to add user to docker group:
```sudo usermod -aG docker $USER`

After adding your user to the group, you must log out and log back in for the new group membership to take effect. Alternatively, you can run the following command to log in to a new group:
```bash
newgrp docker
```

You can check if your user has docker group membership by running:
```bash
groups
```

Once done, try running one of the docker commands:
```bash
docker ps
```

If you’re mounting a volume or working with shared directories, you can adjust file permissions to make sure the current user owns them and has sufficient privileges. Replace /path/to/your/files with the actual path you’re working with:
```bash
sudo chown -R $USER:$USER /path/to/your/files
chmod -R 750 /path/to/your/files
```

The Docker daemon communicates through a Unix socket, typically located at:
```bash
/var/run/docker.sock
```

If your user doesn’t have access to this socket, Docker commands will fail with a permission denied error, even if Docker is correctly installed.
You can run this command to see current ownership and permissions:
```bash
ls -l /var/run/docker.sock
```

You’ll likely see output like:
```bash
srw-rw---- 1 root docker 0 2025-04-05 07:55 /var/run/docker.sock
```

This means only the root user and members of the docker group can access the socket.
It’s technically possible to change the file permissions with:
```bash
sudo chmod 666 /var/run/docker.sock
```

You can restart Docker using system control command:
```bash
sudo service docker restart
```

`docker run hello-world`


## Authentication & User Management

This application enforces a secure authentication system. Access to the tool is restricted to registered users approved by an administrator.

### User Workflow

1. **Registration**: New users must first register an account via the application homepage.
   * **URL**: [http://4.182.249.166:5005/](http://4.182.249.166:5005/)
2. **Approval**: After registration, the account will be in a **pending** state. You cannot log in until an Administrator approves your account.
3. **Login**: Once approved, use your credentials to log in.
4. **Password Management**: Logged-in users can update their passwords via the **"Password"** option in the top navigation bar.

### Admin Workflow

1. **User Approval**: Administrators manage user access via the Admin Portal.
   * **Admin URL**: [http://4.182.249.166:5005/admin](http://4.182.249.166:5005/admin)
2. **User Management**: Admins have the right to approve pending requests and delete existing users from the system.
