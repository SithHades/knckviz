
from playwright.sync_api import sync_playwright

def verify_efficient_frontier():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Set a large viewport to ensure side-by-side layout
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        try:
            # Go to the efficient frontier page
            page.goto("http://localhost:4321/viz/efficient-frontier")

            # Wait for canvas
            page.wait_for_selector("canvas")

            # Wait for animation
            page.wait_for_timeout(2000)

            # Take screenshot of the full page
            page.screenshot(path="verification/efficient_frontier_full.png", full_page=True)
            print("Screenshot saved to verification/efficient_frontier_full.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_efficient_frontier()
