# Designed and Implemented by: Girish Subramanya <girish.subramanya@daimlertruck.com>
# Date: 2025-12-23
# Version: 1

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
