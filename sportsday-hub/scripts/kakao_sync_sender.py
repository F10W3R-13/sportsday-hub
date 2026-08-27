# -*- coding: utf-8 -*-
"""
드라이브 동기화 반영 내역을 카카오톡 단체방에 2통으로 나눠 전송한다.

22:00 드라이브→로컬 동기화(ZCode 자동화)가 요약 메시지를 messages 파일에
남기면 이 스크립트가 읽어 방송한다. UI 자동화(카톡 실행·방 열기·전송)는
kakao_group_sender의 함수를 그대로 재사용한다.

실행 결과는 종료 코드로만 알린다(서버 보고 없음) — 자동화 세션이 직접
결과를 보고하므로 bot_runs/watchdog 채널과는 분리한다.

messages 파일 형식: 메시지를 ===MSG=== 줄로 구분(예: 2통).
파일이 없거나 비어 있으면 발송 없이 정상 종료.
전송 전체 성공 시에만 파일을 지운다(실패 시 재발송용 보존).

실행: python -X utf8 kakao_sync_sender.py [messages파일경로]
드라이런: SYNC_SENDER_DRY=1 설정 시 파싱만 검증(화면 조작 없음).
"""

import sys
import time
from datetime import datetime
from pathlib import Path

import kakao_group_sender as k

DEFAULT_MESSAGES = Path(__file__).resolve().parent / "logs" / "sync_broadcast.txt"
MSG_DELIMITER = "===MSG==="
SEND_GAP_SEC = 2.0
DRY_RUN = bool(k.os.environ.get("SYNC_SENDER_DRY"))


def load_messages(path):
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    return [m.strip() for m in raw.split(MSG_DELIMITER) if m.strip()]


def main():
    if datetime.now() >= k.BOT_END:
        k.log.info("행사 종료(9/20 18:00) 이후 — 발송하지 않음")
        return
    msg_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_MESSAGES
    messages = load_messages(msg_path)
    if not messages:
        k.log.info("발송할 메시지 없음(%s) — 종료", msg_path)
        return
    k.log.info("실행 시작: room=%r 메시지=%d통 dry=%s", k.ROOM_NAME, len(messages), DRY_RUN)
    if DRY_RUN:
        for i, m in enumerate(messages, 1):
            k.log.info("[dry] %d통: %d자 | %s", i, len(m), m.splitlines()[0])
        return
    try:
        k.ensure_kakao_running()
        room = k.open_room_with_retry(k.ROOM_NAME)
        for i, text in enumerate(messages, 1):
            k.send_message(room, text)
            k.log.info("발송 %d/%d통: %d자 | %s", i, len(messages), len(text), text.splitlines()[0])
            if i < len(messages):
                time.sleep(SEND_GAP_SEC)
    except Exception as exc:
        k.log.exception("카카오톡 전송 실패 (창/UI 자동화 오류) — messages 보존: %s", msg_path)
        print(f"SEND_FAIL: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
    msg_path.unlink(missing_ok=True)
    k.log.info("발송 완료 — messages 파일 정리: %s", msg_path)


if __name__ == "__main__":
    main()
