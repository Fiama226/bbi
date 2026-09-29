from playwright.sync_api import sync_playwright
import time
import json

with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="msedge",
        headless=False,
        args=["--ignore-certificate-errors", "--allow-running-insecure-content"]
    )
    
    context = browser.new_context(ignore_https_errors=True)
    page = context.new_page()
    
    # Capture all console messages and errors
    console_logs = []
    page_errors = []
    request_failures = []
    
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: page_errors.append(str(err)))
    page.on("requestfailed", lambda req: request_failures.append(f"{req.url} - {req.failure}"))
    
    debug_url = "https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&debug=true&noredir=true"
    
    print(f"Navigating to workbench...")
    page.goto(debug_url, wait_until="networkidle", timeout=60000)
    
    print("Waiting for SPFx to initialize...")
    time.sleep(8)
    
    # Handle debug scripts dialog
    for i in range(10):
        load_debug_btn = page.locator(
            'button:has-text("Charger les scripts"), '
            'button:has-text("Load debug"), '
            'button:has-text("Load scripts")'
        ).first
        if load_debug_btn.count() > 0 and load_debug_btn.is_visible():
            print("Clicking 'Load debug scripts' button...")
            load_debug_btn.click()
            time.sleep(5)
            break
        time.sleep(1)
    
    # Wait for manifests
    time.sleep(5)
    
    # Click Edit button to enter edit mode
    print("Looking for Edit button...")
    edit_btn = page.locator('button:has-text("Modifier"), button:has-text("Edit")').first
    if edit_btn.count() > 0 and edit_btn.is_visible():
        print("Clicking Edit...")
        edit_btn.click()
        time.sleep(3)
    
    # Click Add webpart
    print("Clicking Add webpart...")
    add_btn = page.locator('[data-automationid="addWebPartButton"]').first
    if add_btn.count() > 0 and add_btn.is_visible():
        add_btn.click()
        time.sleep(2)
    
    # Search for BBI Accueil
    print("Searching for BBI Accueil...")
    search_box = page.locator('input[placeholder*="Search"], input[placeholder*="Rechercher"], input[aria-label*="Search"]').first
    if search_box.count() > 0 and search_box.is_visible():
        search_box.fill("BBI Accueil")
        time.sleep(2)
    
    # Click BBI Accueil webpart
    print("Clicking BBI Accueil...")
    bbi_item = page.locator('text="BBI Accueil (plein écran)"').first
    if bbi_item.count() > 0 and bbi_item.is_visible():
        bbi_item.click()
        time.sleep(5)
    
    # Wait for error to appear
    print("Waiting for potential error...")
    time.sleep(5)
    
    # Check for error message
    error_elements = page.locator("text=Something went wrong").all()
    if error_elements:
        print("\n=== FOUND 'SOMETHING WENT WRONG' ERROR ===")
        for el in error_elements:
            try:
                # Get the full error dialog
                dialog = el.locator("xpath=ancestor::div[contains(@role, 'alertdialog') or contains(@class, 'ms-Dialog')]").first
                if dialog.count() > 0:
                    print(dialog.inner_text()[:2000])
                else:
                    parent = el.locator("xpath=..").first
                    print(parent.inner_text()[:2000])
            except:
                pass
    
    # Also check for any error in the page
    body_text = page.locator("body").inner_text()
    if "Something went wrong" in body_text:
        idx = body_text.index("Something went wrong")
        print(body_text[max(0, idx-200):idx+1500])
    
    # Print recent console errors
    print("\n=== RECENT CONSOLE ERRORS ===")
    for log in console_logs[-30:]:
        if any(kw in log.lower() for kw in ['error', 'failed', 'exception', 'unhandled']):
            print(log)
    
    print("\n=== PAGE ERRORS ===")
    for err in page_errors:
        print(err)
    
    print("\n=== REQUEST FAILURES ===")
    for req in request_failures[-20:]:
        print(req)
    
    # Final screenshot
    page.screenshot(path="error_state.png", full_page=True)
    print("\nScreenshot saved to error_state.png")
    
    time.sleep(10)
    browser.close()