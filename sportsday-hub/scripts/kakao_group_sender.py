# -*- coding: utf-8 -*-
"""
카카오톡 단체방 자동 전송 스크립트.

sportsday-hub의 /api/digest/today 에서 오늘의 체크리스트 다이제스트를 받아
PC 카카오톡에서 지정한 일반 채팅방에 붙여넣고 전송한다.

사전 준비:
  pip install requests pyautogui pyperclip
  - PC 카카오 자동로그인 상태여야 함(미실행 시 설치 경로에서 직접 실행 시도)
  - 환경변수 또는 아래 상수로 설정:
      DIGEST_API_URL  기본 https://sportsday-hub.vercel.app/api/digest/today
      CRON_SECRET     Vercel에 설정된 CRON_SECRET (없으면 인증 생략)
      KAKAO_ROOM_NAME 전송할 채팅방 이름
      REPORT_URL      실행 결과 보고 엔드포인트 (기본 .../api/kakao-bot/report)

실행 예시:
  set KAKAO_ROOM_NAME=스포츠데이 && python kakao_group_sender.py
"""

import logging
import os
import subprocess
import sys
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

import pyautogui
import pyperclip
import requests

API_URL = os.environ.get("DIGEST_API_URL", "https://sportsday-hub.vercel.app/api/digest/today")
CRON_SECRET = os.environ.get("CRON_SECRET", "")
ROOM_NAME = os.environ.get("KAKAO_ROOM_NAME", "스포츠데이")
REPORT_URL = os.environ.get("REPORT_URL", "https://sportsday-hub.vercel.app/api/kakao-bot/report")

SEARCH_WAIT_SEC = 1.5
ROOM_OPEN_WAIT_SEC = 1.5
KAKAO_LAUNCH_WAIT_SEC = 15

# 카톡 미실행 시 직접 실행에 사용할 설치 경로 후보(일반적인 64/32비트 설치 위치).
KAKAO_EXE_CANDIDATES = [
    r"C:\Program Files\Kakao\KakaoTalk\KakaoTalk.exe",
    r"C:\Program Files (x86)\Kakao\KakaoTalk\KakaoTalk.exe",
]

# 작업 스케줄러 자동 실행은 콘솔이 곧 닫히므로 결과를 반드시 파일로 남긴다.
LOG_PATH = Path(__file__).resolve().parent / "logs" / "kakao_sender.log"
LOG_PATH.parent.mkdir(exist_ok=True)
logging.basicConfig(
    handlers=[RotatingFileHandler(LOG_PATH, maxBytes=200_000, backupCount=2, encoding="utf-8")],
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("kakao_sender")


def fetch_digest():
    headers = {"authorization": f"Bearer {CRON_SECRET}"} if CRON_SECRET else {}
    res = requests.get(API_URL, headers=headers, timeout=15)
    res.raise_for_status()
    return res.json().get("text")


def report(status, detail=None):
    """실행 결과를 서버에 보고. 보고 자체가 실패해도 로그만 남긴다(주 흐름 방해 않음)."""
    try:
        res = requests.post(REPORT_URL, json={"status": status, "detail": detail},
                            headers={"authorization": f"Bearer {CRON_SECRET}"} if CRON_SECRET else {},
                            timeout=10)
        log.info("보고 완료: status=%s http=%d", status, res.status_code)
    except Exception:
        log.exception("서버 보고 실패 (REPORT_URL=%s)", REPORT_URL)


def find_window(title_part):
    for window in pyautogui.getAllWindows():
        if title_part in window.title:
            return window
    return None


def ensure_kakao_running():
    """카톡이 떠 있지 않으면 설치 경로에서 직접 실행해 창이 뜰 때까지 기다린다."""
    if find_window("카카오톡") is not None:
        return
    exe = next((p for p in KAKAO_EXE_CANDIDATES if Path(p).exists()), None)
    if exe is None:
        raise RuntimeError("카카오톡이 실행돼 있지 않고 설치 경로도 찾지 못했습니다.")
    log.info("카카오톡 미실행 — 직접 실행: %s", exe)
    subprocess.Popen([exe])
    deadline = time.time() + KAKAO_LAUNCH_WAIT_SEC
    while time.time() < deadline:
        if find_window("카카오톡") is not None:
            return
        time.sleep(1)
    raise RuntimeError("카카오톡 실행 후 15초 내 창이 나타나지 않습니다(자동로그인 확인 필요).")


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


def open_room_with_retry(room_name):
    """방 열기를 1회 재시도(검색 타이밍 실패 흡수)."""
    try:
        return open_room(room_name)
    except RuntimeError:
        log.warning("방 열기 1차 실패 — 재시도")
        time.sleep(2)
        return open_room(room_name)


def send_message(room, text):
    left, top, width, height = room.left, room.top, room.width, room.height
    pyautogui.click(left + width // 2, top + int(height * 0.88))
    time.sleep(0.3)
    pyperclip.copy(text)
    pyautogui.hotkey("ctrl", "v")
    time.sleep(0.3)
    pyautogui.press("enter")


def main():
    log.info("실행 시작: room=%r api=%s secret=%s", ROOM_NAME, API_URL, "설정됨" if CRON_SECRET else "없음(인증 생략)")
    try:
        text = fetch_digest()
    except Exception:
        detail = "다이제스트 조회 실패 (API/네트워크 오류)"
        log.exception(detail)
        report("fail", detail)
        sys.exit(1)
    if not text:
        log.info("임박 항목 없음 — 전송 생략")
        report("success", "임박 항목 없음 — 전송 생략")
        return
    try:
        ensure_kakao_running()
        room = open_room_with_retry(ROOM_NAME)
        send_message(room, text)
        log.info("발송 완료: room=%r 길이=%d자 | %s", ROOM_NAME, len(text), text.splitlines()[0])
        report("success")
    except Exception as exc:
        detail = f"{type(exc).__name__}: {exc}"
        log.exception("카카오톡 전송 실패 (창/UI 자동화 오류)")
        report("fail", detail)
        sys.exit(1)


if __name__ == "__main__":
    main()
