import re
from playwright.sync_api import Page, expect


def test_conditional_dog_flow(page: Page):
    page.goto("https://www.cnn.com")
    # Try to accept cookies if the button appears
    try:
        page.get_by_text("Agree", exact=True).click(timeout=3000)
    except Exception:
        pass

    page_text = page.locator("body").inner_text().lower()
    contains_dog = "dog" in page_text

    if contains_dog:
        print('The word "dog" was found on the page. Running Flow A...')
        page.click("text=World")
        expect(page).to_have_url(re.compile("world"))
    else:
        print('The word "dog" was NOT found on the page. Running Flow B...')
        expect(page).to_have_url(re.compile("cnn"))
