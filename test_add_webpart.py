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
    
    page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))
    page.on("requestfailed", lambda req: print(f"[REQUEST FAILED] {req.url} - {req.failure}"))
    
    debug_url = "https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&debug=true&noredir=true"
    
    print(f"Navigating to workbench: {debug_url}")
    page.goto(debug_url, wait_until="networkidle", timeout=60000)
    
    print("Waiting for SPFx to initialize...")
    time.sleep(8)
    
    # Handle debug scripts dialog if present
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
    
    # Check if we need to enter edit mode - look for Edit button
    print("Checking for Edit button...")
    edit_buttons = page.locator(
        'button:has-text("Edit"), '
        '[data-automationid="editButton"], '
        'button[aria-label*="Edit"], '
        '.ms-Button:has-text("Edit")'
    ).all()
    
    for btn in edit_buttons:
        try:
            if btn.is_visible():
                print(f"Found Edit button, clicking...")
                btn.click()
                time.sleep(3)
                break
        except:
            pass
    
    # Now look for Add webpart button
    print("Looking for 'Add a web part' button...")
    add_selectors = [
        '[data-automationid="addWebPartButton"]',
        'button:has-text("Add a web part")',
        'button:has-text("Add web part")',
        '[title*="Add"]',
        'button[aria-label*="Add web part"]'
    ]
    
    for sel in add_selectors:
        btns = page.locator(sel).all()
        if btns:
            print(f"Found {len(btns)} buttons with selector: {sel}")
            for btn in btns:
                try:
                    if btn.is_visible():
                        print(f"  Clicking visible button...")
                        btn.click()
                        time.sleep(2)
                        page.screenshot(path="webpart_picker.png", full_page=True)
                        break
                except:
                    pass
    
    # Search for BBI Home
    time.sleep(2)
    search_box = page.locator('input[placeholder*="Search"], input[aria-label*="Search"], input[placeholder*="Rechercher"]').first
    if search_box.count() > 0 and search_box.is_visible():
        print("Searching for 'BBI'...")
        search_box.fill("BBI")
        time.sleep(2)
        
        # Click on BBI Home webpart
        bbi_items = page.locator('text="BBI Accueil"').all()
        if bbi_items:
            print(f"Found {len(bbi_items)} 'BBI Accueil' items")
            for item in bbi_items:
                try:
                    if item.is_visible():
                        print("Clicking BBI Accueil...")
                        item.click()
                        time.sleep(3)
                        page.screenshot(path="after_add_webpart.png", full_page=True)
                        break
                except:
                    pass
        else:
            print("BBI Accueil not found, listing all webparts...")
            items = page.locator('[data-automationid="webPartPickerItem"], .webPartPickerItem, [role="option"]').all()
            print(f"Found {len(items)} webparts in picker")
            for item in items[:30]:
                try:
                    text = item.inner_text()[:100]
                    if text.strip():
                        print(f"  - {text}")
                except:
                    pass
    
    # Final screenshot
    page.screenshot(path="final_state.png", full_page=True)
    print("Done. Check screenshots.")
    
    time.sleep(15)
    browser.close()