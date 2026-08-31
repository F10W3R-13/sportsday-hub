# -*- coding: utf-8 -*-
"""
미발송 카톡 방송 회복 태스크 (작업 스케줄러 KakaoPendingRecovery, 15분 주기 18:00~23:45 + 로그온).

18시 다이제스트(kakao_group_sender)·22시 동기화 방송(drive_sync_bot)이 발송에
실패하면 각자 logs/ 아래 마커를 남긴다(digest_pending.flag / sync_pending.flag,
첫 줄=실패 날짜). 이 스크립트는 마커가 '오늘' 것일 때만 해당 봇을 재실행한다.
봇은 재수행 후 성공 시 스스로 마커를 지운다(22시 봇은 커밋 전 발송 구조라
재실행이 멱등 — 같은 변경분이 겹쳐 보내지지 않는다). 네트워크·카톡 로그인
대기는 각 봇 내부에서 처리하므로 여기서는 즉시 재실행만 한다.

어제 이전 마커는 발송 시점이 지난 것이므로 회복하지 않고 삭제만 한다.
드라이런: KAKAO_RECOVER_DRY=1 — 마커 확인·로그만 남긴다(재실행·삭제 없음).
"""

import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kakao_group_sender as k  # noqa: E402  (로그·BOT_END 재사용)

DRY_RUN = bool(os.environ.get("KAKAO_RECOVER_DRY"))
LOGS = Path(__file__).resolve().parent / "logs"
LANES = [
    (LOGS / "digest_pending.flag", "kakao_group_sender.py", "18시 다이제스트"),
    (LOGS / "sync_pending.flag", "drive_sync_bot.py", "22시 동기화 방송"),
]


def main():
    if datetime.now() >= k.BOT_END:
        return
    today = f"{datetime.now():%Y-%m-%d}"
    acted = False
    for flag, script, label in LANES:
        if not flag.exists():
            continue
        lines = flag.read_text(encoding="utf-8").splitlines()
        date, reason = (lines + ["(사유 없음)"] * 2)[:2]
        if date.strip() != today:
            if DRY_RUN:
                k.log.info("[recover][dry] 지난 마커(폐기 예정): %s (%s)", flag.name, date.strip())
                continue
            k.log.info("[recover] 지난 마커 폐기(발송 시점 지남): %s (%s)", flag.name, date.strip())
            flag.unlink(missing_ok=True)
            acted = True
            continue
        if DRY_RUN:
            k.log.info("[recover][dry] %s 재실행 예정 — 사유: %s", label, reason[:80])
            continue
        k.log.info("[recover] %s 재실행 — 사유: %s", label, reason[:80])
        r = subprocess.run([sys.executable, "-X", "utf8", script],
                           cwd=str(Path(__file__).resolve().parent))
        k.log.info("[recover] %s 종료 코드 %d — 마커 잔존: %s", label, r.returncode, flag.exists())
        acted = True
    if not acted:
        k.log.info("[recover]%s 회복 대상 없음", " [dry]" if DRY_RUN else "")


if __name__ == "__main__":
    main()
