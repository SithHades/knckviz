from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to home page...")
            page.goto("http://localhost:4321/viz")
            page.wait_for_selector("body")

            print("Checking for new card...")
            new_card = page.get_by_text("Option Path Tracer")
            expect(new_card).to_be_visible()

            print("Navigating to visualization...")
            page.goto("http://localhost:4321/viz/option-pricing")

            print("Waiting for canvas...")
            page.wait_for_selector("canvas", timeout=10000)

            print("Waiting for simulation to run...")
            page.wait_for_timeout(2000) # Wait for animation

            print("Taking screenshot...")
            page.screenshot(path="verification/option_pricing.png", full_page=True)
            print("Screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_state.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
