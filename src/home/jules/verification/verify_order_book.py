from playwright.sync_api import sync_playwright

def verify_order_book():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the Order Book visualization page
            page.goto("http://localhost:4321/viz/order-book")

            # Wait for the main canvas to be visible
            page.wait_for_selector("canvas", timeout=10000)

            # Wait a bit for simulation to run and orders to populate
            page.wait_for_timeout(2000)

            # Verify controls are present
            # Regime selector
            regime_select = page.get_by_role("combobox")
            if regime_select.count() == 0:
                print("Regime selector not found")

            # Change Regime
            regime_select.select_option("VOLATILE")

            # Toggle an agent (Deep MM)
            # Find checkbox for Deep MM
            # The label is "Deep MM", check associated checkbox
            # We can find the text "Deep MM" and then find the checkbox near it.
            # Or use get_by_label if I used labels correctly, but I used a div structure.
            # I'll rely on text locator.
            deep_mm_text = page.get_by_text("Deep MM")
            # The checkbox is a sibling or parent/child structure?
            # <div ...><input type="checkbox"> <span>Deep MM</span> ...</div>
            # So we can look for the input inside the parent of the text.
            # Or just use the input with accent color if accessible?
            # Let's try locating the checkbox by looking for the input preceding the text
            # Actually, Playwright's get_by_label works if there is a <label> tag, but I used <div>.
            # Let's try to click the checkbox directly if we can identify it.
            # We can find all checkboxes.
            checkboxes = page.get_by_role("checkbox")
            # We expect 3 checkboxes for agents + 1 for "AI Market Maker Agent" if it was kept?
            # I removed the old "AI Market Maker Agent" checkbox and replaced it with the list.

            # Let's click the second checkbox (Deep MM is second in list)
            checkboxes.nth(1).click()

            # Wait a bit more
            page.wait_for_timeout(2000)

            # Take screenshot
            page.screenshot(path="/home/jules/verification/order_book_viz.png", full_page=True)
            print("Screenshot taken at /home/jules/verification/order_book_viz.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_order_book()
