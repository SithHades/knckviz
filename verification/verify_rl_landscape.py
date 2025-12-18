
from playwright.sync_api import sync_playwright

def verify_rl_landscape():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Go to the new visualization page
            page.goto("http://localhost:4321/viz/rl-value-landscape")

            # Wait for canvas to load
            page.wait_for_selector("canvas", timeout=10000)

            # Wait a bit for Three.js to render
            page.wait_for_timeout(2000)

            # Click 'Start Simulation' button
            page.get_by_text("Start Simulation").click()

            # Wait for some simulation to happen
            page.wait_for_timeout(3000)

            # Take screenshot
            page.screenshot(path="verification/rl_landscape.png", full_page=True)
            print("Screenshot taken: verification/rl_landscape.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_rl_landscape()
