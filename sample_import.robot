*** Settings ***
Library    SeleniumLibrary
Resource    keywords.robot

*** Variables ***
${URL}    http://example.com

*** Test Cases ***
Imported Test Case
    [Documentation]    This is a test case imported from file
    Open Browser    http://example.com    chrome
    Sleep    2s
