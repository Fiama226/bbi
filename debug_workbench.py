from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    # Launch MS Edge (chromium channel)
    browser = p.chromium.launch(
        channel="msedge",
        headless=False,
        args=["--ignore-certificate-errors", "--allow-running-insecure-content"]
    )
    
    context = browser.new_context(
        ignore_https_errors=True,
        record_video_dir="videos/"
    )
    
    page = context.new_page()
    
    # Capture console messages
    page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))
    page.on("requestfailed", lambda req: print(f"[REQUEST FAILED] {req.url} - {req.failure}"))
    
    # First, go to the tenant homepage to ensure we're logged in
    print("Navigating to tenant homepage first...")
    page.goto("https://businessbuilderinter.sharepoint.com/", wait_until="networkidle", timeout=60000)
    time.sleep(3)
    page.screenshot(path="tenant_home.png", full_page=True)
    
    # Check if we need to login
    if page.locator('input[name="loginfmt"]').count() > 0:
        print("Login required - please log in manually in the browser window")
        print("Waiting for login to complete...")
        page.wait_for_url("https://businessbuilderinter.sharepoint.com/*", timeout=120000)
        time.sleep(3)
    
    # Now go to workbench with debug URL
    debug_url = "https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&debug=true&noredir=true"
    
    print(f"Navigating to workbench: {debug_url}")
    page.goto(debug_url, wait_until="networkidle", timeout=60000)
    
    print("Page loaded, waiting for SPFx to initialize...")
    time.sleep(5)
    
    # Handle the "Load debug scripts" dialog - wait for it to appear
    print("Waiting for debug scripts dialog...")
    for i in range(10):
        # Try multiple button texts
        load_debug_btn = page.locator(
            'button:has-text("Charger les scripts"), '
            'button:has-text("Load debug"), '
            'button:has-text("Load scripts"), '
            'button[role="button"]:has-text("Charger"), '
            '.ms-Dialog button:has-text("Charger")'
        ).first
        
        if load_debug_btn.count() > 0 and load_debug_btn.is_visible():
            print(f"Found and clicking 'Load debug scripts' button (attempt {i+1})...")
            load_debug_btn.click()
            time.sleep(5)
            page.screenshot(path="after_load_debug.png", full_page=True)
            break
        time.sleep(1)
    
    # Also check for iframe dialog
    iframes = page.frames
    for frame in iframes:
        try:
            btn = frame.locator('button:has-text("Charger"), button:has-text("Load")').first
            if btn.count() > 0 and btn.is_visible():
                print("Found button in iframe, clicking...")
                btn.click()
                time.sleep(5)
                break
        except:
            pass
    
    # Wait more for manifests to load
    print("Waiting for manifests to load...")
    time.sleep(8)
    
    # Check if manifests loaded - look for script tags
    scripts = page.locator("script[src*='manifests.js']").all()
    print(f"Found {len(scripts)} manifest script tags")
    for s in scripts:
        try:
            print(f"  Script src: {s.get_attribute('src')[:150]}")
        except:
            pass
    
    # Check all scripts for localhost
    all_scripts = page.locator("script[src*='localhost']").all()
    print(f"Found {len(all_scripts)} localhost scripts")
    for s in all_scripts:
        try:
            print(f"  Script src: {s.get_attribute('src')[:150]}")
        except:
            pass
    
    # Check page title and URL
    print(f"Page title: {page.title()}")
    print(f"Current URL: {page.url}")
    
    # Check for error messages
    error_elements = page.locator("text=Something went wrong").all()
    if error_elements:
        print("Found 'Something went wrong' error!")
        for el in error_elements:
            try:
                parent = el.locator("xpath=ancestor::div[contains(@class, 'error') or contains(@role, 'alert')]").first
                if parent:
                    print(parent.inner_text()[:1000])
            except:
                pass
    
    # Check for any error dialog
    error_dialogs = page.locator('[role="alertdialog"], .ms-Dialog--error, .ms-MessageBar--error').all()
    for d in error_dialogs:
        print(f"Error dialog: {d.inner_text()[:500]}")
    
    # Try to add the webpart
    print("Checking for edit mode...")
    page.wait_for_timeout(3000)
    
    # Look for add webpart button
    selectors = [
        '[data-automationid="addWebPartButton"]',
        'button:has-text("Add a web part")',
        '[title*="Add"]',
        '.ms-Button:has-text("Add")',
        '[data-automation-id="addWebPartButton"]',
        'button[aria-label*="Add"]'
    ]
    
    for sel in selectors:
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
    
    # Check canvas area
    canvas_selectors = [
        '[data-automationid="canvasZone"]',
        '.CanvasZone',
        '[role="main"]',
        '.workbenchCanvas'
    ]
    for sel in canvas_selectors:
        canvas = page.locator(sel).first
        if canvas.count() > 0:
            print(f"Canvas found with selector: {sel}")
            canvas.screenshot(path="canvas.png")
            break
    
    # Full page screenshot
    page.screenshot(path="workbench_final.png", full_page=True)
    print("Final screenshot saved")
    
    # Check page content for error
    body_text = page.locator("body").inner_text()
    if "Something went wrong" in body_text:
        print("\n=== ERROR FOUND IN PAGE ===")
        idx = body_text.index("Something went wrong")
        print(body_text[max(0, idx-200):idx+1000])
    
    # Wait for manual inspection
    print("Waiting 20 seconds for manual inspection...")
    page.wait_for_timeout(20000)
    
    browser.close()