from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="msedge",
        headless=False,
        args=["--ignore-certificate-errors", "--allow-running-insecure-content"]
    )
    
    context = browser.new_context(ignore_https_errors=True)
    page = context.new_page()
    
    console_logs = []
    page_errors = []
    
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: page_errors.append(str(err)))
    
    debug_url = "https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&debug=true&noredir=true"
    
    print(f"Navigating to workbench...")
    page.goto(debug_url, wait_until="networkidle", timeout=60000)
    
    print("Waiting for SPFx to initialize...")
    time.sleep(10)
    
    # Handle debug scripts dialog
    for i in range(15):
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
    
    # Print all console logs that might be errors
    print("\n=== ALL CONSOLE LOGS ===")
    for log in console_logs:
        print(log)
    
    # Check if webpart is already on page (maybe pre-configured)
    webpart_canvas = page.locator('[data-automationid="CanvasZone"] .webpart, .CanvasZone [data-sp-webpart]').all()
    print(f"\nWebparts on canvas: {len(webpart_canvas)}")
    
    # Check for any error dialog
    dialogs = page.locator('[role="alertdialog"], .ms-Dialog').all()
    print(f"Dialogs found: {len(dialogs)}")
    for d in dialogs:
        try:
            print(d.inner_text()[:1000])
        except:
            pass
    
    # Try to add webpart again, more carefully
    print("\n=== Trying to add webpart ===")
    
    # Check if in edit mode
    edit_mode = page.locator('[data-automationid="CanvasZone"][data-is-in-edit-mode="true"]').count() > 0
    print(f"In edit mode: {edit_mode}")
    
    # Click Edit if not in edit mode
    if not edit_mode:
        edit_btn = page.locator('button:has-text("Modifier"), button:has-text("Edit"), [data-automationid="editButton"]').first
        if edit_btn.count() > 0 and edit_btn.is_visible():
            print("Clicking Edit...")
            edit_btn.click()
            time.sleep(3)
    
    # Click add webpart in first zone
    add_zones = page.locator('[data-automationid="addWebPartButton"], button[aria-label*="Add web part"]').all()
    print(f"Add webpart zones: {len(add_zones)}")
    
    for i, zone in enumerate(add_zones):
        try:
            if zone.is_visible():
                print(f"Clicking add webpart zone {i}...")
                zone.click()
                time.sleep(3)
                break
        except:
            pass
    
    # Search for BBI
    search_box = page.locator('input[placeholder*="Search"], input[placeholder*="Rechercher"]').first
    if search_box.count() > 0 and search_box.is_visible():
        print("Searching for BBI...")
        search_box.fill("BBI")
        time.sleep(3)
    
    # Click BBI Accueil
    bbi_items = page.locator('text="BBI Accueil"').all()
    print(f"BBI Accueil items found: {len(bbi_items)}")
    
    for item in bbi_items:
        try:
            if item.is_visible():
                print("Clicking BBI Accueil...")
                item.click()
                time.sleep(5)
                break
        except:
            pass
    
    # Wait and check for error
    time.sleep(5)
    
    # Check for error
    error_elements = page.locator("text=Something went wrong").all()
    if error_elements:
        print("\n=== FOUND ERROR ===")
        for el in error_elements:
            try:
                dialog = el.locator("xpath=ancestor::div[contains(@role, 'alertdialog')]").first
                if dialog.count() > 0:
                    print(dialog.inner_text()[:3000])
                else:
                    # Get parent hierarchy
                    parent = el
                    for _ in range(5):
                        parent = parent.locator("xpath=..").first
                        text = parent.inner_text()
                        if "Technical Details" in text or "ERROR" in text or "[object Object]" in text:
                            print(text[:3000])
                            break
            except:
                pass
    
    # Print any new console errors
    print("\n=== NEW CONSOLE LOGS ===")
    for log in console_logs[-50:]:
        if any(kw in log.lower() for kw in ['error', 'failed', 'exception', 'unhandled', 'rejected', 'something']):
            print(log)
    
    print("\n=== PAGE ERRORS ===")
    for err in page_errors:
        print(err)
    
    page.screenshot(path="final_error.png", full_page=True)
    print("\nScreenshot saved")
    
    time.sleep(15)
    browser.close()