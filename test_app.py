import unittest
import json
from app import app
import users

class TestApp(unittest.TestCase):
    def setUp(self):
        app.testing = True
        app.config['WTF_CSRF_ENABLED'] = False # Disable CSRF for testing
        self.client = app.test_client()

        # Setup test db
        users.DB_NAME = "test_users.db"
        users.init_db()
        # Create an approved user for testing
        users.add_user('testuser', 'testpassword', is_approved=True)

    def login(self):
        return self.client.post('/login', data=dict(
            username='testuser',
            password='testpassword'
        ), follow_redirects=True)

    def tearDown(self):
        import os
        if os.path.exists("test_users.db"):
            os.remove("test_users.db")

    def test_index_redirects_if_not_logged_in(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login', response.headers['Location'])

    def test_index_loads_config(self):
        self.login()
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'DTTF Test Case Generator', response.data)

    def test_generate_simple_test_case(self):
        self.login()
        payload = {
            "settings": "Library    SeleniumLibrary",
            "testCases": [
                {
                    "name": "My Test",
                    "doc": "My Doc",
                    "steps": [
                        {
                            "name": "Open Browser",
                            "args": [
                                {"name": "url", "value": "http://google.com"},
                                {"name": "browser", "value": "chrome"}
                            ]
                        }
                    ]
                }
            ]
        }
        response = self.client.post('/generate',
                                    data=json.dumps(payload),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)

        expected_robot = "*** Settings ***\nLibrary    SeleniumLibrary\n\n*** Test Cases ***\nMy Test\n    [Documentation]    My Doc\n    Open Browser    http://google.com    chrome\n"
        self.assertEqual(data['robot'], expected_robot)

    def test_generate_empty_args_preserved(self):
        self.login()
        payload = {
            "testCases": [
                {
                    "name": "Empty Arg Test",
                    "steps": [
                        {
                            "name": "My Keyword",
                            "args": [
                                {"name": "arg1", "value": "val1"},
                                {"name": "arg2", "value": ""},
                                {"name": "arg3", "value": "val3"}
                            ]
                        }
                    ]
                }
            ]
        }
        response = self.client.post('/generate',
                                    data=json.dumps(payload),
                                    content_type='application/json')
        data = json.loads(response.data)
        self.assertIn("My Keyword    val1        val3", data['robot'])

    def test_generate_variables(self):
        self.login()
        payload = {
            "variables": [
                {"type": "Scalar", "name": "URL", "value": "http://test.com"},
                {"type": "List", "name": "ITEMS", "value": "Item 1\nItem 2"},
                {"type": "Dictionary", "name": "USER", "value": "name=John\nage=30"}
            ]
        }
        response = self.client.post('/generate',
                                    data=json.dumps(payload),
                                    content_type='application/json')
        data = json.loads(response.data)

        self.assertIn("*** Variables ***", data['robot'])
        self.assertIn("${URL}    http://test.com", data['robot'])
        self.assertIn("@{ITEMS}    Item 1    Item 2", data['robot'])
        self.assertIn("&{USER}    name=John    age=30", data['robot'])

    def test_settings_header_deduplication(self):
        self.login()
        # Case 1: Header provided by user
        payload = {
            "settings": "*** Settings ***\nLibrary    SeleniumLibrary"
        }
        response = self.client.post('/generate',
                                    data=json.dumps(payload),
                                    content_type='application/json')
        data = json.loads(response.data)
        # Should not have duplicate header
        self.assertEqual(data['robot'].count("*** Settings ***"), 1)

        # Case 2: Header NOT provided
        payload = {
            "settings": "Library    SeleniumLibrary"
        }
        response = self.client.post('/generate',
                                    data=json.dumps(payload),
                                    content_type='application/json')
        data = json.loads(response.data)
        self.assertIn("*** Settings ***", data['robot'])

if __name__ == '__main__':
    unittest.main()
