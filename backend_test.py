#!/usr/bin/env python3
"""
Backend API Testing for Mr Ermin Chat Application
Tests authentication, chat management, and message functionality
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://saveconvo.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

# Test data - realistic user data
TEST_USER_DATA = {
    "email": "maria.schmidt@gmail.com",
    "name": "Maria Schmidt",
    "picture": "https://lh3.googleusercontent.com/a/default-user",
    "google_id": "108234567890123456789"
}

# Global variables for test state
access_token = None
user_id = None
chat_id = None

def print_test_result(test_name, success, details=""):
    """Print formatted test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   Details: {details}")
    print()

def test_health_check():
    """Test basic API connectivity"""
    print("🔍 Testing API Health Check...")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        success = response.status_code == 200
        details = f"Status: {response.status_code}, Response: {response.json() if success else response.text}"
        print_test_result("API Health Check", success, details)
        return success
    except Exception as e:
        print_test_result("API Health Check", False, f"Connection error: {str(e)}")
        return False

def test_user_login():
    """Test user login/registration with Google OAuth data"""
    global access_token, user_id
    print("🔍 Testing User Authentication...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            headers=HEADERS,
            json=TEST_USER_DATA,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            access_token = data.get("access_token")
            user_info = data.get("user", {})
            user_id = user_info.get("id")
            
            success = bool(access_token and user_id)
            details = f"Token received: {bool(access_token)}, User ID: {user_id}, Email: {user_info.get('email')}"
            print_test_result("User Login/Registration", success, details)
            return success
        else:
            print_test_result("User Login/Registration", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("User Login/Registration", False, f"Error: {str(e)}")
        return False

def test_get_current_user():
    """Test getting current user information with JWT token"""
    print("🔍 Testing Get Current User...")
    
    if not access_token:
        print_test_result("Get Current User", False, "No access token available")
        return False
    
    try:
        auth_headers = {**HEADERS, "Authorization": f"Bearer {access_token}"}
        response = requests.get(
            f"{BASE_URL}/auth/me",
            headers=auth_headers,
            timeout=10
        )
        
        if response.status_code == 200:
            user_data = response.json()
            success = user_data.get("email") == TEST_USER_DATA["email"]
            details = f"Email: {user_data.get('email')}, Name: {user_data.get('name')}, Verified: {user_data.get('verified')}"
            print_test_result("Get Current User", success, details)
            return success
        else:
            print_test_result("Get Current User", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Get Current User", False, f"Error: {str(e)}")
        return False

def test_email_verification():
    """Test email verification endpoint"""
    print("🔍 Testing Email Verification...")
    
    try:
        # Test with dummy token - should fail gracefully
        response = requests.post(
            f"{BASE_URL}/auth/verify-email",
            headers=HEADERS,
            params={"token": "dummy-verification-token"},
            timeout=10
        )
        
        # Should return 400 for invalid token
        success = response.status_code == 400
        details = f"Status: {response.status_code} (expected 400 for invalid token)"
        print_test_result("Email Verification (Invalid Token)", success, details)
        return success
        
    except Exception as e:
        print_test_result("Email Verification", False, f"Error: {str(e)}")
        return False

def test_create_chat():
    """Test creating a new chat"""
    global chat_id
    print("🔍 Testing Create Chat...")
    
    if not access_token:
        print_test_result("Create Chat", False, "No access token available")
        return False
    
    try:
        auth_headers = {**HEADERS, "Authorization": f"Bearer {access_token}"}
        chat_data = {"title": "Diskussion über KI-Entwicklung"}
        
        response = requests.post(
            f"{BASE_URL}/chats",
            headers=auth_headers,
            json=chat_data,
            timeout=10
        )
        
        if response.status_code == 200:
            chat = response.json()
            chat_id = chat.get("id")
            success = bool(chat_id and chat.get("title") == chat_data["title"])
            details = f"Chat ID: {chat_id}, Title: {chat.get('title')}, User ID: {chat.get('user_id')}"
            print_test_result("Create Chat", success, details)
            return success
        else:
            print_test_result("Create Chat", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Create Chat", False, f"Error: {str(e)}")
        return False

def test_get_user_chats():
    """Test getting all chats for authenticated user"""
    print("🔍 Testing Get User Chats...")
    
    if not access_token:
        print_test_result("Get User Chats", False, "No access token available")
        return False
    
    try:
        auth_headers = {**HEADERS, "Authorization": f"Bearer {access_token}"}
        response = requests.get(
            f"{BASE_URL}/chats",
            headers=auth_headers,
            timeout=10
        )
        
        if response.status_code == 200:
            chats = response.json()
            success = isinstance(chats, list) and len(chats) >= 1
            details = f"Found {len(chats)} chats"
            if chats:
                details += f", First chat: {chats[0].get('title', 'No title')}"
            print_test_result("Get User Chats", success, details)
            return success
        else:
            print_test_result("Get User Chats", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Get User Chats", False, f"Error: {str(e)}")
        return False

def test_get_specific_chat():
    """Test getting a specific chat"""
    print("🔍 Testing Get Specific Chat...")
    
    if not access_token or not chat_id:
        print_test_result("Get Specific Chat", False, "No access token or chat ID available")
        return False
    
    try:
        auth_headers = {**HEADERS, "Authorization": f"Bearer {access_token}"}
        response = requests.get(
            f"{BASE_URL}/chats/{chat_id}",
            headers=auth_headers,
            timeout=10
        )
        
        if response.status_code == 200:
            chat = response.json()
            success = chat.get("id") == chat_id
            details = f"Chat ID: {chat.get('id')}, Title: {chat.get('title')}, Messages: {len(chat.get('messages', []))}"
            print_test_result("Get Specific Chat", success, details)
            return success
        else:
            print_test_result("Get Specific Chat", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Get Specific Chat", False, f"Error: {str(e)}")
        return False

def test_update_chat():
    """Test updating chat title"""
    print("🔍 Testing Update Chat...")
    
    if not access_token or not chat_id:
        print_test_result("Update Chat", False, "No access token or chat ID available")
        return False
    
    try:
        auth_headers = {**HEADERS, "Authorization": f"Bearer {access_token}"}
        update_data = {"title": "Erweiterte KI-Diskussion und Zukunftsperspektiven"}
        
        response = requests.put(
            f"{BASE_URL}/chats/{chat_id}",
            headers=auth_headers,
            json=update_data,
            timeout=10
        )
        
        if response.status_code == 200:
            chat = response.json()
            success = chat.get("title") == update_data["title"]
            details = f"Updated title: {chat.get('title')}"
            print_test_result("Update Chat", success, details)
            return success
        else:
            print_test_result("Update Chat", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Update Chat", False, f"Error: {str(e)}")
        return False

def test_add_message_to_chat():
    """Test adding messages to a chat"""
    print("🔍 Testing Add Message to Chat...")
    
    if not access_token or not chat_id:
        print_test_result("Add Message to Chat", False, "No access token or chat ID available")
        return False
    
    try:
        auth_headers = {**HEADERS, "Authorization": f"Bearer {access_token}"}
        
        # Add user message
        user_message = {
            "role": "user",
            "content": "Wie wird sich künstliche Intelligenz in den nächsten 10 Jahren entwickeln?"
        }
        
        response = requests.post(
            f"{BASE_URL}/chats/{chat_id}/messages",
            headers=auth_headers,
            json=user_message,
            timeout=10
        )
        
        user_success = response.status_code == 200
        
        # Add assistant message
        assistant_message = {
            "role": "assistant",
            "content": "Die Entwicklung der KI wird voraussichtlich in mehreren Bereichen bedeutende Fortschritte machen: Verbesserung der natürlichen Sprachverarbeitung, autonome Systeme, und Integration in alltägliche Anwendungen."
        }
        
        response2 = requests.post(
            f"{BASE_URL}/chats/{chat_id}/messages",
            headers=auth_headers,
            json=assistant_message,
            timeout=10
        )
        
        assistant_success = response2.status_code == 200
        success = user_success and assistant_success
        details = f"User message: {user_success}, Assistant message: {assistant_success}"
        print_test_result("Add Message to Chat", success, details)
        return success
        
    except Exception as e:
        print_test_result("Add Message to Chat", False, f"Error: {str(e)}")
        return False

def test_get_chat_messages():
    """Test getting messages from a chat"""
    print("🔍 Testing Get Chat Messages...")
    
    if not access_token or not chat_id:
        print_test_result("Get Chat Messages", False, "No access token or chat ID available")
        return False
    
    try:
        auth_headers = {**HEADERS, "Authorization": f"Bearer {access_token}"}
        response = requests.get(
            f"{BASE_URL}/chats/{chat_id}/messages",
            headers=auth_headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            messages = data.get("messages", [])
            success = len(messages) >= 2  # Should have at least the 2 messages we added
            details = f"Found {len(messages)} messages"
            if messages:
                details += f", First message role: {messages[0].get('role')}"
            print_test_result("Get Chat Messages", success, details)
            return success
        else:
            print_test_result("Get Chat Messages", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Get Chat Messages", False, f"Error: {str(e)}")
        return False

def test_authentication_protection():
    """Test that protected endpoints reject requests without authentication"""
    print("🔍 Testing Authentication Protection...")
    
    try:
        # Test accessing protected endpoint without token
        response = requests.get(f"{BASE_URL}/chats", headers=HEADERS, timeout=10)
        success = response.status_code == 401
        details = f"Status: {response.status_code} (expected 401 for unauthenticated request)"
        print_test_result("Authentication Protection", success, details)
        return success
        
    except Exception as e:
        print_test_result("Authentication Protection", False, f"Error: {str(e)}")
        return False

def test_delete_chat():
    """Test deleting a chat"""
    print("🔍 Testing Delete Chat...")
    
    if not access_token or not chat_id:
        print_test_result("Delete Chat", False, "No access token or chat ID available")
        return False
    
    try:
        auth_headers = {**HEADERS, "Authorization": f"Bearer {access_token}"}
        response = requests.delete(
            f"{BASE_URL}/chats/{chat_id}",
            headers=auth_headers,
            timeout=10
        )
        
        if response.status_code == 200:
            # Verify chat is deleted by trying to get it
            get_response = requests.get(
                f"{BASE_URL}/chats/{chat_id}",
                headers=auth_headers,
                timeout=10
            )
            success = get_response.status_code == 404
            details = f"Delete status: 200, Verification status: {get_response.status_code} (expected 404)"
            print_test_result("Delete Chat", success, details)
            return success
        else:
            print_test_result("Delete Chat", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Delete Chat", False, f"Error: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests in sequence"""
    print("=" * 60)
    print("🚀 STARTING MR ERMIN CHAT BACKEND API TESTS")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Test user: {TEST_USER_DATA['name']} ({TEST_USER_DATA['email']})")
    print()
    
    test_results = []
    
    # Basic connectivity
    test_results.append(("Health Check", test_health_check()))
    
    # Authentication tests
    test_results.append(("User Login", test_user_login()))
    test_results.append(("Get Current User", test_get_current_user()))
    test_results.append(("Email Verification", test_email_verification()))
    test_results.append(("Authentication Protection", test_authentication_protection()))
    
    # Chat management tests
    test_results.append(("Create Chat", test_create_chat()))
    test_results.append(("Get User Chats", test_get_user_chats()))
    test_results.append(("Get Specific Chat", test_get_specific_chat()))
    test_results.append(("Update Chat", test_update_chat()))
    
    # Message management tests
    test_results.append(("Add Message to Chat", test_add_message_to_chat()))
    test_results.append(("Get Chat Messages", test_get_chat_messages()))
    
    # Cleanup tests
    test_results.append(("Delete Chat", test_delete_chat()))
    
    # Summary
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print()
    print(f"Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Backend API is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the details above.")
    
    return passed == total

if __name__ == "__main__":
    run_all_tests()