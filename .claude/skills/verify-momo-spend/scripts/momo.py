#!/usr/bin/env python3
"""Drive the MoMo Spend app on an adb-attached Android emulator by accessibility text.

Usage: momo.py <command> [args]
  doctor                     read-only: adb device, Metro on 8081, Expo Go installed, foreground app
  texts                      print every visible text / content-desc, one per line
  has <text>                 exit 0 if the text is visible, 1 if not
  tap-id <testID>            tap the element with that testID (Android resource-id)
  has-id <testID>            exit 0 if an element with that testID is on screen
  tap <text>                 tap the element whose text or content-desc equals <text>
  tap-xy <x> <y>             tap raw pixels (last resort)
  type <text>                type into the focused field (spaces allowed)
  scroll                     swipe up one screen (content moves up)
  back                       Android back
  shot <path.png>            screenshot
  state <text>               print checked/selected flags of the element
  tap-switch <text>          tap the switch labelled <text>
  switch-state <text>        print checked=true|false for the switch labelled <text>
  wait <text> [seconds]      wait until <text> is visible (default 30s)
  open                       open the project in Expo Go (recent history, else Enter URL)
"""
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ADB = ["adb"]
EXPO_GO = "host.exp.exponent"
URL = "exp://localhost:8081"


def adb(*args, capture=True, binary=False):
    r = subprocess.run(ADB + list(args), capture_output=capture, text=not binary)
    return r.stdout


def dump():
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    xml = adb("shell", "cat", "/sdcard/ui.xml")
    return ET.fromstring(xml[xml.index("<"):])


def center(n):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.get("bounds"))
    x1, y1, x2, y2 = map(int, m.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2


def nodes():
    for n in dump().iter("node"):
        label = n.get("text") or n.get("content-desc")
        if label:
            yield label, center(n)


def switch(text):
    """The checkable node (a switch) labelled <text>; the row title with the same words is a different node."""
    for n in dump().iter("node"):
        if n.get("checkable") == "true" and (n.get("text") or n.get("content-desc")) == text:
            return n
    return None


def state(text):
    for n in dump().iter("node"):
        if (n.get("text") or n.get("content-desc")) == text:
            return {k: n.get(k) for k in ("checked", "selected", "enabled")}
    return None


def find_id(test_id):
    for n in dump().iter("node"):
        if n.get("resource-id") == test_id:
            return center(n)
    return None


def find(text):
    for label, xy in nodes():
        if label == text:
            return xy
    return None


def tap_xy(x, y):
    adb("shell", "input", "tap", str(x), str(y))


def wait(text, seconds=30):
    end = time.time() + seconds
    while time.time() < end:
        if find(text):
            return True
        time.sleep(1)
    return False


def doctor():
    devices = [l for l in adb("devices").splitlines()[1:] if l.strip().endswith("device")]
    print("device:", devices[0].split()[0] if devices else "NONE")
    print("expo go:", "installed" if EXPO_GO in adb("shell", "pm", "list", "packages") else "MISSING")
    adb("reverse", "tcp:8081", "tcp:8081")
    status = subprocess.run(["curl", "-s", "-m", "3", "http://localhost:8081/status"], capture_output=True, text=True).stdout
    print("metro:", status or "NOT RESPONDING on :8081")
    focus = [l for l in adb("shell", "dumpsys", "window").splitlines() if "mCurrentFocus" in l]
    print("foreground:", focus[0].strip() if focus else "unknown")


def open_project():
    adb("reverse", "tcp:8081", "tcp:8081")
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", URL, EXPO_GO)
    time.sleep(3)
    if find("momo-spend"):
        tap_xy(*find("momo-spend"))
    elif find("Enter URL"):
        tap_xy(*find("Enter URL"))
        time.sleep(1)
        adb("shell", "input", "text", URL)
        adb("shell", "input", "keyevent", "66")
    ok = wait("Home", 90)
    print("opened" if ok else "project did not reach Home")
    sys.exit(0 if ok else 1)


def main():
    cmd, args = (sys.argv[1] if len(sys.argv) > 1 else "help"), sys.argv[2:]
    if cmd == "doctor":
        doctor()
    elif cmd == "texts":
        for label, _ in nodes():
            print(label)
    elif cmd == "has":
        sys.exit(0 if find(args[0]) else 1)
    elif cmd == "tap":
        xy = find(args[0])
        if not xy:
            sys.exit(f"not visible: {args[0]}")
        tap_xy(*xy)
    elif cmd == "tap-id":
        xy = find_id(args[0])
        if not xy:
            sys.exit(f"no element with testID: {args[0]}")
        tap_xy(*xy)
    elif cmd == "has-id":
        sys.exit(0 if find_id(args[0]) else 1)
    elif cmd == "tap-xy":
        tap_xy(args[0], args[1])
    elif cmd == "type":
        adb("shell", "input", "text", args[0].replace(" ", "%s"))
    elif cmd == "scroll":
        adb("shell", "input", "swipe", "540", "1700", "540", "600", "300")
    elif cmd == "back":
        adb("shell", "input", "keyevent", "4")
    elif cmd == "shot":
        open(args[0], "wb").write(adb("exec-out", "screencap", "-p", binary=True))
    elif cmd == "tap-switch":
        n = switch(args[0])
        if n is None:
            sys.exit(f"no switch: {args[0]}")
        tap_xy(*center(n))
    elif cmd == "switch-state":
        n = switch(args[0])
        if n is None:
            sys.exit(f"no switch: {args[0]}")
        print("checked=" + n.get("checked"))
    elif cmd == "state":
        flags = state(args[0])
        if flags is None:
            sys.exit(f"not visible: {args[0]}")
        print(" ".join(f"{k}={v}" for k, v in flags.items()))
    elif cmd == "wait":
        sys.exit(0 if wait(args[0], int(args[1]) if len(args) > 1 else 30) else 1)
    elif cmd == "open":
        open_project()
    else:
        print(__doc__)


main()
