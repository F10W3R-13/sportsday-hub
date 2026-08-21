# -*- coding: utf-8 -*-
"""
카카오톡 단체방 자동 전송 스크립트.

sportsday-hub의 /api/digest/today 에서 오늘의 체크리스트 다이제스트를 받아
PC 카카오톡에서 지정한 일반 채팅방에 붙여넣고 전송한다.

사전 준비:
  pip install requests pyautogui pyperclip
  - PC 카카오톡 실행 + 자동로그인 상태여야 함
  - 환경변수 또는 아래 상수로 설정:
      DIGEST_API_URL  기본 https://sportsday-hub.vercel.app/api/digest/today
      CRON_SECRET     Vercel에 설정된 CRON_SECRET (없으면 인증 생략)
      KAKAO_ROOM_NAME 전송할 채팅방 이름

실행 예시:
  set KAKAO_ROOM_NAME=스포츠데이 && python kakao_group_sender.py
"""

import os
import sys
import time

import pyautogui
import pyperclip
import requests

API_URL = os.environ.get("DIGEST_API_URL", "https://sportsday-hub.vercel.app/api/digest/today")
CRON_SECRET = os.environ.get("CRON_SECRET", "")
ROOM_NAME = os.environ.get("KAKAO_ROOM_NAME", "스포츠데이")

SEARCH_WAIT_SEC = 1.5
ROOM_OPEN_WAIT_SEC = 1.5


def fetch_digest():
    headers = {"authorization": f"Bearer {CRON_SECRET}"} if CRON_SECRET else {}
    res = requests.get(API_URL, headers=headers, timeout=15)
    res.raise_for_status()
    return res.json().get("text")


def find_window(title_part):
    for window in pyautogui.getAllWindows():
        if title_part in window.title:
            return window
    return None


def open_room(room_name):
    main = find_window("카카오톡")
    if main is None:
        raise RuntimeError("카카오톡 창을 찾을 수 없습니다. PC 카카오톡을 실행하고 로그인하세요.")
    main.activate()
    time.sleep(0.5)

    pyautogui.hotkey("ctrl", "f")
    time.sleep(0.5)
    pyperclip.copy(room_name)
    pyautogui.hotkey("ctrl", "v")
    time.sleep(SEARCH_WAIT_SEC)
    pyautogui.press("enter")
    time.sleep(ROOM_OPEN_WAIT_SEC)

    room = find_window(room_name)
    if room is None:
        raise RuntimeError(f"'{room_name}' 채팅방을 열지 못했습니다. 방 이름을 확인하세요.")
    room.activate()
    time.sleep(0.5)
    return room


def send_message(room, text):
    left, top, width, height = room.left, room.top, room.width, room.height
    pyautogui.click(left + width // 2, top + int(height * 0.88))
    time.sleep(0.3)
    pyperclip.copy(text)
    pyautogui.hotkey("ctrl", "v")
    time.sleep(0.3)
    pyautogui.press("enter")


def main():
    text = fetch_digest()
    if not text:
        print("임박 항목이 없어 전송하지 않았습니다.")
        return
    try:
        room = open_room(ROOM_NAME)
        send_message(room, text)
        print(f"'{ROOM_NAME}' 방에 발송 완료:\n{text}")
    except Exception as exc:
        print(f"실패: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
