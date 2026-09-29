from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    # Use persistent context with existing Edge profile
    user_data_dir = r"C:\Users\KABORE\AppData\Local\Microsoft\Edge\User Data"
    
    context = p.chromium.launch_persistent_context(
        user_data_dir=user_data_dir,
        channel="msedge",
        headless=False,
        args=[
            "--ignore-certificate-errors",
            "--allow-running-insecure-content",
            "--profile-directory=Default"  # Use Default profile
        ],
        ignore_https_errors=True
    )
    
    page = context.pages[0] if context.pages else context.new_page()
    
    console_logs = []
    page_errors = []
    
    def handle_console(msg):
        console_logs.append(f"[{msg.type}] {msg.text}")
        if any(kw in msg.text.lower() for kw in ['error', 'failed', 'exception', 'unhandled', 'rejected', 'something went wrong', 'object object']):
            print(f"[CONSOLE {msg.type}] {msg.text}")
    
    def handle_page_error(err):
        page_errors.append(str(err))
        print(f"[PAGE ERROR] {err}")
    
    page.on("console", handle_console)
    page.on("pageerror", handle_page_error)
    
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
        try:
            if load_debug_btn.count() > 0 and load_debug_btn.is_visible():
                print("Clicking 'Load debug scripts' button...")
                load_debug_btn.click()
                time.sleep(5)
                break
        except:
            pass
        time.sleep(1)
    
    # Wait for manifests
    time.sleep(5)
    
    print("\n=== CONSOLE LOGS SO FAR ===")
    for log in console_logs[-20:]:
        print(log)
    
    # Keep browser open for manual testing
    print("\n=== BROWSER OPEN FOR MANUAL TESTING ===")
    print("Please manually:")
    print("1. Click 'Modifier' (Edit) if not in edit mode")
    print("2. Click 'Add a web part' (+ button)")
    print("3. Search for 'BBI Accueil' and add it")
    print("4. Observe the error")
    print("\nPress Enter in this terminal when done...")
    
    try:
        input()
    except EOFError:
        time.sleep(60)
    
    # Check for error after manual test
    error_elements = page.locator("text=Something went wrong").all()
    if error_elements:
        print("\n=== FOUND ERROR ===")
        for el in error_elements:
            try:
                dialog = el.locator("xpath=ancestor::div[contains(@role, 'alertdialog')]").first
                if dialog.count() > 0:
                    print(dialog.inner_text()[:3000])
                else:
                    parent = el.locator("xpath=..").first
                    print(parent.inner_text()[:3000])
            except:
                pass
    
    print("\n=== ALL CONSOLE LOGS ===")
    for log in console_logs:
        if any(kw in log.lower() for kw in ['error', 'failed', 'exception', 'unhandled', 'rejected', 'something', 'object']):
            print(log)
    
    print("\n=== PAGE ERRORS ===")
    for err in page_errors:
        print(err)
    
    page.screenshot(path="manual_test_error.png", full_page=True)
    print("\nScreenshot saved")
    
    context.close()