"""
Designed and Implemented by: Girish Subramanya <girish.subramanya@daimlertruck.com>
Date: 2025-12-23
Version: 1
"""
from robot.api import get_model
from robot.parsing.model.blocks import TestCaseSection, SettingSection, VariableSection
from robot.parsing.model.statements import TestCaseName, KeywordCall, Variable

def parse_robot_content(content):
    model = get_model(content)

    data = {
        "settings": "",
        "variables": [],
        "testCases": []
    }

    for section in model.sections:
        if isinstance(section, SettingSection):
            # Reconstruct settings block text (simplified)
            # Or just iterate statements
            lines = []
            for stmt in section.body:
                # stmt.tokens contains the raw tokens including separators
                # simplest is to just use original lines if possible, but we parsed string.
                # Let's reconstruct from tokens.
                # Or just grab the text?
                # section.body is list of statements.
                # stmt.to_list() gives ["Library", "SeleniumLibrary"] etc.
                parts = [t.value for t in stmt.tokens]
                lines.append("    ".join(parts))
            data["settings"] = "\n".join(lines)

        elif isinstance(section, VariableSection):
            for stmt in section.body:
                if isinstance(stmt, Variable):
                    # stmt.name is ${VAR}, stmt.value is list of values
                    # We need to strip ${} @{} &{} for our data model
                    raw_name = stmt.name
                    var_type = "Scalar"
                    if raw_name.startswith("@"): var_type = "List"
                    elif raw_name.startswith("&"): var_type = "Dictionary"

                    name = raw_name[2:-1] # Remove ${ and }
                    value = "\n".join(stmt.value)

                    data["variables"].append({
                        "id": f"var_{name}", # Generate a temp ID
                        "type": var_type,
                        "name": name,
                        "value": value
                    })

        elif isinstance(section, TestCaseSection):
            for test in section.body:
                if isinstance(test, TestCaseName):
                    # This is just the name line? No, TestCase object contains body.
                    # Wait, in RF 4.0+ parsing model:
                    # Section -> body -> TestCase -> body -> KeywordCall
                    pass

            # Actually section.body contains the TestCases.
            # Let's iterate properly.
            for item in section.body:
                 # Check if it is a TestCase (it might be a Comment or EmptyLine)
                 # In RF API, it's typically a 'TestCase' object if it has a name
                 if hasattr(item, 'name'):
                    tc = {
                        "id": f"tc_{item.name.replace(' ', '_')}",
                        "name": item.name,
                        "doc": "",
                        "tags": [],
                        "setup": "",
                        "teardown": "",
                        "steps": []
                    }

                    for stmt in item.body:
                        if stmt.type == 'DOCUMENTATION':
                            tc["doc"] = stmt.value
                        elif stmt.type == 'TAGS':
                            tc["tags"] = list(stmt.values)
                        elif stmt.type == 'SETUP':
                            # stmt.name is keyword name, stmt.args are arguments
                            # Construct string "Keyword    arg1    arg2"
                            parts = [stmt.name] + list(stmt.args)
                            tc["setup"] = "    ".join(parts)
                        elif stmt.type == 'TEARDOWN':
                            parts = [stmt.name] + list(stmt.args)
                            tc["teardown"] = "    ".join(parts)
                        elif stmt.type == 'KEYWORD':
                            # Keyword Call
                            # stmt.name is Keyword Name
                            # stmt.args is list of args

                            # match args to config?
                            # For now, we just create a step with raw args.
                            # The frontend will need to display them.
                            # If we want the properties panel to work, we need to map positional args
                            # to the named args in config.

                            step_args = []
                            for arg in stmt.args:
                                step_args.append({"value": arg})

                            tc["steps"].append({
                                "id": f"step_{len(tc['steps'])}",
                                "name": stmt.keyword,
                                "args": step_args # List of {value: "..."}
                                # We lose parameter names here unless we look up config.
                                # The frontend should handle mapping if possible.
                            })

                    data["testCases"].append(tc)

    return data
