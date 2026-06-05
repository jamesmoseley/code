import requests

BASE_URL = "http://localhost:8000"

# uses requests library to test REST API correctly returns todo items following the Arrange-Act-Assert pattern

def test_get_all_todos():
    # Arrange: Set up the endpoint URL
    url = f"{BASE_URL}/todos"
    
    # Act: Perform the action (calling the API)
    response = requests.get(url)
    
    # Assert: Verify the behavior meets requirements
    assert response.status_code == 200
    todos = response.json()
    assert isinstance(todos, list)
    assert len(todos) > 0