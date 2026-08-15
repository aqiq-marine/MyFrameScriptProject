from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

from progress import (
    calculate_script_progress,
    calculate_lab_mora_progress,
    calculate_sequence_progress,
)

# ============================================================
# 設定
# ============================================================

TIME_SCALE = 10_000_000

PUNCTUATION = "、"

# confidence
DEFAULT_MIN_CONFIDENCE = 0.60

# ------------------------------------------------------------
# pauマッチング
# ------------------------------------------------------------

# pau数が読点数より多い場合、
# 余分なpauをSKIPするコスト。
SKIP_PAUSE_SCORE = -0.25

# 読点とpauの位置ズレに対する係数。
POSITION_ERROR_WEIGHT = 2.0

# pauの極端に短いものを少し疑う。
SHORT_PAUSE_THRESHOLD = 0.03

# 十分なpauseとみなす最低時間。
# ただし、これを理由にpauseを除外はしない。
MIN_REASONABLE_PAUSE = 0.05


# ============================================================
# TXT側
# ============================================================

@dataclass
class ScriptBreak:
    """
    原稿中の「、」。
    """

    index: int

    # 原稿上の「、」の位置
    char: int

    # 「、」までの文字進捗
    progress: float


@dataclass
class ScriptAnalysis:
    breaks: List[ScriptBreak]

    # 有効文字数
    text_length: int


# ============================================================
# LAB側
# ============================================================

@dataclass
class LabPause:
    """
    LAB中のpau。
    """

    index: int

    start: int
    end: int
    duration: int

    # LAB全体に対する時間進捗
    progress: float


# ============================================================
# マッチ結果
# ============================================================

@dataclass
class BreakMatch:
    script_break_index: int
    pause_index: int

    score: float
    confidence: float

    time: float
    pause_duration: float

    # 読点とpauseの進捗差
    position_error: float

    # 余分なpauをSKIPした場合などの情報
    skipped_pause_before: int = 0


# ============================================================
# TXT解析
# ============================================================

def analyze_script(
    script: str,
) -> ScriptAnalysis:
    """
    TXTから読点「、」を抽出する。

    読み・モーラ・OpenJTalkは一切使わない。

    例:

        今日は、とてもいい天気なので、公園に行きます。

    →

        break[0] = 「、」の位置
        break[1] = 「、」の位置
    """

    if not script:
        return ScriptAnalysis(
            breaks=[],
            text_length=0,
        )

    # --------------------------------------------------------
    # 空白・改行は進捗計算から除外
    # --------------------------------------------------------

    effective_chars = [
        ch
        for ch in script
        if ch not in " \t\r\n"
    ]

    text_length = max(
        1,
        len(effective_chars),
    )

    # --------------------------------------------------------
    # 元文字列上の位置を走査
    # --------------------------------------------------------

    breaks: List[ScriptBreak] = []

    effective_index = 0

    for char_index, ch in enumerate(script):

        if ch in " \t\r\n":
            continue

        effective_index += 1

        if ch != PUNCTUATION:
            continue

        text_before_break = "".join(
            effective_chars[:effective_index]
        )
        progress = calculate_script_progress(
            text_before_break,
            script
        )

        breaks.append(
            ScriptBreak(
                index=len(breaks),
                char=char_index + 1,
                progress=progress,
            )
        )

    return ScriptAnalysis(
        breaks=breaks,
        text_length=text_length,
    )


# ============================================================
# LAB解析
# ============================================================

def normalize_lab_symbol(
    symbol: str,
) -> str:
    """
    LABのsymbolを正規化する。

    pauの表記揺れだけ吸収する。
    """

    if not symbol:
        return ""

    symbol = symbol.strip()

    aliases = {
        "pau": "pau",
        "sil": "pau",
        "sp": "pau",
    }

    return aliases.get(
        symbol.lower(),
        symbol,
    )


def lab_symbols_to_pauses(
    lipsync: Sequence[Dict[str, Any]],
) -> Tuple[
    List[LabPause],
    Optional[int],
    Optional[int],
]:
    """
    LABからpauだけを抽出する。

    progressは時間ではなく、
    モーラ単位の進捗として計算する。

    戻り値:

        pauses
        first_time
        last_time
    """

    pauses: List[LabPause] = []

    first_time: Optional[int] = None
    last_time: Optional[int] = None

    # --------------------------------------------------------
    # LAB全体のsymbolを保持
    # --------------------------------------------------------

    all_symbols: List[str] = []

    # 各pauについて、
    # 「そのpauより前に存在するsymbol」を保存する。
    symbols_before_each_pause: List[
        List[str]
    ] = []

    current_symbols: List[str] = []

    # --------------------------------------------------------
    # LAB走査
    # --------------------------------------------------------

    for cue in lipsync:

        symbol = normalize_lab_symbol(
            str(
                cue.get(
                    "symbol",
                    "",
                )
            )
        )

        start = int(
            cue.get("start", 0)
            or 0
        )

        end = int(
            cue.get("end", 0)
            or 0
        )

        # ----------------------------------------------------
        # LAB全体の時間範囲
        #
        # これはmetadata/debug用として残す。
        # progress計算には使わない。
        # ----------------------------------------------------

        if first_time is None:
            first_time = start
        else:
            first_time = min(
                first_time,
                start,
            )

        if last_time is None:
            last_time = end
        else:
            last_time = max(
                last_time,
                end,
            )

        # ----------------------------------------------------
        # pau
        # ----------------------------------------------------

        if symbol == "pau":

            pause = LabPause(
                index=len(pauses),
                start=start,
                end=end,
                duration=max(
                    0,
                    end - start,
                ),
                progress=0.0,
            )

            pauses.append(
                pause
            )

            # このpauより前までの音素を保存
            symbols_before_each_pause.append(
                list(current_symbols)
            )

            # pau自身は発話モーラではないので、
            # current_symbolsには追加しない。

            continue

        # ----------------------------------------------------
        # 通常音素
        # ----------------------------------------------------

        if symbol:
            current_symbols.append(
                symbol
            )

        all_symbols.append(
            symbol
        )

    # --------------------------------------------------------
    # モーラ進捗を計算
    # --------------------------------------------------------

    for i, pause in enumerate(pauses):

        symbols_before_pau = (
            symbols_before_each_pause[i]
        )

        pause.progress = (
            calculate_lab_mora_progress(
                symbols_before_pau,
                all_symbols,
            )
        )

    return (
        pauses,
        first_time,
        last_time,
    )


# ============================================================
# 読点 ↔ pau のマッチング
# ============================================================

def match_breaks_by_order(
    script: ScriptAnalysis,
    pauses: Sequence[LabPause],
) -> List[BreakMatch]:
    """
    読点とpauを対応させる。

    基本方針:

        読点数 == pau数
            ↓
        完全な順序対応

    pauが余る場合:

        読点 ↔ pau
              ↓
        単調性を保ったDP

    読み・モーラ・音素は使用しない。
    """

    script_breaks = script.breaks

    n = len(script_breaks)
    m = len(pauses)

    if n == 0 or m == 0:
        return []

    # --------------------------------------------------------
    # 正常ケース
    #
    # 読点数 == pau数
    #
    # ここではDPすらしない。
    # --------------------------------------------------------

    if n == m:

        results: List[BreakMatch] = []

        for i in range(n):

            br = script_breaks[i]
            pause = pauses[i]

            position_error = abs(
                br.progress
                -
                pause.progress
            )

            # 同数・順序対応なので、
            # position_errorは補助情報。
            confidence = (
                1.0
                -
                min(
                    1.0,
                    position_error,
                )
                * 0.30
            )

            # pauseが極端に短い場合は少し下げる。
            pause_duration = (
                pause.duration /
                TIME_SCALE
            )

            if (
                pause_duration
                <
                SHORT_PAUSE_THRESHOLD
            ):
                confidence *= 0.90

            confidence = max(
                0.0,
                min(
                    1.0,
                    confidence,
                ),
            )

            results.append(
                BreakMatch(
                    script_break_index=i,
                    pause_index=pause.index,
                    score=confidence,
                    confidence=confidence,
                    time=(
                        pause.start /
                        TIME_SCALE
                    ),
                    pause_duration=pause_duration,
                    position_error=position_error,
                    skipped_pause_before=0,
                )
            )

        return results

    # --------------------------------------------------------
    # pau不足
    #
    # 前提上、本来ここには来ない。
    # ただし安全のため処理する。
    # --------------------------------------------------------

    if m < n:

        print(
            "[WARNING] "
            f"script commas={n}, "
            f"LAB pauses={m}. "
            "There are fewer LAB pauses than script commas."
        )

        # できるだけ順序対応させる。
        count = min(n, m)

        results = []

        for i in range(count):

            br = script_breaks[i]
            pause = pauses[i]

            position_error = abs(
                br.progress
                -
                pause.progress
            )

            confidence = max(
                0.0,
                0.7
                -
                position_error,
            )

            results.append(
                BreakMatch(
                    script_break_index=i,
                    pause_index=pause.index,
                    score=confidence,
                    confidence=confidence,
                    time=(
                        pause.start /
                        TIME_SCALE
                    ),
                    pause_duration=(
                        pause.duration /
                        TIME_SCALE
                    ),
                    position_error=position_error,
                    skipped_pause_before=0,
                )
            )

        return results

    # --------------------------------------------------------
    # pauが余っているケース
    #
    # 読点は全部残し、
    # pauだけSKIP可能。
    #
    # match:
    #     script comma -> LAB pau
    #
    # skip:
    #     LAB pauを無視
    # --------------------------------------------------------

    NEG_INF = -10**9

    dp = [
        [NEG_INF] * (m + 1)
        for _ in range(n + 1)
    ]

    trace = [
        [None] * (m + 1)
        for _ in range(n + 1)
    ]

    dp[0][0] = 0.0

    for i in range(n + 1):

        for j in range(m + 1):

            current = dp[i][j]

            if current <= NEG_INF / 2:
                continue

            # ------------------------------------------------
            # 読点とpauを対応
            # ------------------------------------------------

            if i < n and j < m:

                br = script_breaks[i]
                pause = pauses[j]

                position_error = abs(
                    br.progress
                    -
                    pause.progress
                )

                score = (
                    -POSITION_ERROR_WEIGHT
                    *
                    position_error
                )

                value = current + score

                if value > dp[i + 1][j + 1]:

                    dp[i + 1][j + 1] = value

                    trace[i + 1][j + 1] = (
                        "match",
                        i,
                        j,
                    )

            # ------------------------------------------------
            # LABのpauだけSKIP
            # ------------------------------------------------

            if j < m:

                value = (
                    current
                    +
                    SKIP_PAUSE_SCORE
                )

                if value > dp[i][j + 1]:

                    dp[i][j + 1] = value

                    trace[i][j + 1] = (
                        "skip_pause",
                        i,
                        j,
                    )

    # --------------------------------------------------------
    # バックトラック
    # --------------------------------------------------------

    i = n
    j = m

    raw_results: List[
        Tuple[
            int,
            int,
            float,
            int,
        ]
    ] = []

    skipped_before = 0

    while i > 0 or j > 0:

        step = trace[i][j]

        if step is None:
            break

        kind, pi, pj = step

        if kind == "match":

            br = script_breaks[pi]
            pause = pauses[pj]

            position_error = abs(
                br.progress
                -
                pause.progress
            )

            raw_results.append(
                (
                    pi,
                    pj,
                    position_error,
                    skipped_before,
                )
            )

            skipped_before = 0

            i = pi
            j = pj

        elif kind == "skip_pause":

            skipped_before += 1

            i = pi
            j = pj

    raw_results.reverse()

    # --------------------------------------------------------
    # confidence計算
    # --------------------------------------------------------

    results: List[BreakMatch] = []

    for (
        script_index,
        pause_index,
        position_error,
        skipped_before,
    ) in raw_results:

        pause = pauses[pause_index]

        # 位置誤差
        confidence = max(
            0.0,
            1.0
            -
            position_error
            * 1.5,
        )

        # 余分なpauを飛ばした場合は少し下げる。
        if skipped_before > 0:

            confidence -= (
                0.10
                *
                skipped_before
            )

        pause_duration = (
            pause.duration /
            TIME_SCALE
        )

        # 極端に短いpauは少し警戒。
        if (
            pause_duration
            <
            SHORT_PAUSE_THRESHOLD
        ):

            confidence *= 0.90

        confidence = max(
            0.0,
            min(
                1.0,
                confidence,
            ),
        )

        results.append(
            BreakMatch(
                script_break_index=(
                    script_index
                ),
                pause_index=(
                    pause_index
                ),
                score=confidence,
                confidence=confidence,
                time=(
                    pause.start /
                    TIME_SCALE
                ),
                pause_duration=(
                    pause_duration
                ),
                position_error=(
                    position_error
                ),
                skipped_pause_before=(
                    skipped_before
                ),
            )
        )

    return results


# ============================================================
# 最終API
# ============================================================

def estimate_breaks(
    script_text: str,
    lipsync: Sequence[Dict[str, Any]],
    *,
    min_confidence: float = DEFAULT_MIN_CONFIDENCE,
    include_metadata: bool = True,
) -> List[Dict[str, Any]]:
    """
    TXT中の「、」をLABのpauに対応させて
    break位置を推定する。

    重要:

        ・OpenJTalkを使用しない
        ・読みを比較しない
        ・モーラを比較しない
        ・音素を比較しない
        ・読点とpauの時系列関係だけを見る

    基本:

        TXT:
            A、B、C、D
             ↑   ↑
             0   1

        LAB:
            A pau B pau C
              ↑       ↑

        →

            comma[0] -> pau[0]
            comma[1] -> pau[1]
    """

    # --------------------------------------------------------
    # TXT
    # --------------------------------------------------------

    script = analyze_script(
        script_text
    )

    # --------------------------------------------------------
    # LAB
    # --------------------------------------------------------

    pauses, first_time, last_time = (
        lab_symbols_to_pauses(
            lipsync
        )
    )

    # --------------------------------------------------------
    # 原点
    # --------------------------------------------------------

    breaks: List[
        Dict[str, Any]
    ] = [
        {
            "char": 0,
            "time": 0.0,
            "priority": 0,
            "confidence": 1.0,
        }
    ]

    if not script.breaks:
        return breaks

    if not pauses:

        print(
            "[WARNING] "
            "Script contains commas, "
            "but LAB contains no pau."
        )

        return breaks

    # --------------------------------------------------------
    # 読点 ↔ pau
    # --------------------------------------------------------

    matches = match_breaks_by_order(
        script,
        pauses,
    )

    # --------------------------------------------------------
    # 結果
    # --------------------------------------------------------

    for match in matches:

        br = script.breaks[
            match.script_break_index
        ]

        # ----------------------------------------------------
        # confidence不足
        # ----------------------------------------------------

        if (
            match.confidence
            <
            min_confidence
        ):

            print(
                "[SKIP] "
                f"confidence="
                f"{match.confidence:.3f} "
                f"char="
                f"{br.char} "
                f"time="
                f"{match.time:.3f} "
                f"pause="
                f"{match.pause_index} "
                f"position_error="
                f"{match.position_error:.3f}"
            )

            continue

        item = {
            "char": br.char,
            "time": match.time,
            "priority": 1,
            "confidence": round(
                match.confidence,
                3,
            ),
        }

        if include_metadata:

            item.update(
                {
                    "punctuation": "、",

                    "script_break_index": (
                        match.script_break_index
                    ),

                    "pause_index": (
                        match.pause_index
                    ),

                    "pause_duration": round(
                        match.pause_duration,
                        3,
                    ),

                    "position_error": round(
                        match.position_error,
                        4,
                    ),

                    "skipped_pause_before": (
                        match.skipped_pause_before
                    ),
                }
            )

        breaks.append(item)

    # --------------------------------------------------------
    # 原稿順
    # --------------------------------------------------------

    breaks.sort(
        key=lambda x: x["char"]
    )

    return breaks


# ============================================================
# デバッグ
# ============================================================

def debug_breaks(
    script_text: str,
    lipsync: Sequence[Dict[str, Any]],
) -> None:
    """
    読点とpauの対応を確認する。
    """

    script = analyze_script(
        script_text
    )

    pauses, first_time, last_time = (
        lab_symbols_to_pauses(
            lipsync
        )
    )

    matches = match_breaks_by_order(
        script,
        pauses,
    )

    # --------------------------------------------------------
    # TXT
    # --------------------------------------------------------

    print()
    print("=" * 80)
    print("SCRIPT COMMAS")
    print("=" * 80)

    print(
        f"comma_count={len(script.breaks)}"
    )

    for br in script.breaks:

        print(
            f"[{br.index:03d}] "
            f"char={br.char:4d} "
            f"progress={br.progress:.3f}"
        )

    # --------------------------------------------------------
    # LAB
    # --------------------------------------------------------

    print()
    print("=" * 80)
    print("LAB PAUSES")
    print("=" * 80)

    print(
        f"pause_count={len(pauses)}"
    )

    for pause in pauses:

        print(
            f"[{pause.index:03d}] "
            f"start="
            f"{pause.start / TIME_SCALE:.3f} "
            f"end="
            f"{pause.end / TIME_SCALE:.3f} "
            f"duration="
            f"{pause.duration / TIME_SCALE:.3f} "
            f"progress="
            f"{pause.progress:.3f}"
        )

    # --------------------------------------------------------
    # 対応
    # --------------------------------------------------------

    print()
    print("=" * 80)
    print("BREAK MATCHES")
    print("=" * 80)

    for match in matches:

        br = script.breaks[
            match.script_break_index
        ]

        pause = pauses[
            match.pause_index
        ]

        print(
            f"comma[{match.script_break_index:03d}] "
            f"char={br.char:4d} "
            f"-> "
            f"pau[{match.pause_index:03d}] "
            f"time="
            f"{pause.start / TIME_SCALE:.3f} "
            f"duration="
            f"{pause.duration / TIME_SCALE:.3f} "
            f"confidence="
            f"{match.confidence:.3f} "
            f"position_error="
            f"{match.position_error:.3f} "
            f"skipped_before="
            f"{match.skipped_pause_before}"
        )

    # --------------------------------------------------------
    # SKIPされたpau
    # --------------------------------------------------------

    matched_pause_indices = {
        match.pause_index
        for match in matches
    }

    skipped = [
        pause
        for pause in pauses
        if pause.index
        not in matched_pause_indices
    ]

    print()
    print("=" * 80)
    print("SKIPPED LAB PAUSES")
    print("=" * 80)

    if not skipped:

        print("(none)")

    else:

        for pause in skipped:

            print(
                "[SKIP] "
                f"pau[{pause.index}] "
                f"time="
                f"{pause.start / TIME_SCALE:.3f} "
                f"duration="
                f"{pause.duration / TIME_SCALE:.3f}"
            )


# ============================================================
# 使用例
# ============================================================

if __name__ == "__main__":

    script = (
        "今日は、とてもいい天気ですね。"
        "せっかくなので、公園に行きましょう。"
    )

    lipsync = [
        {"symbol": "ky", "start": 0, "end": 100000},
        {"symbol": "o", "start": 100000, "end": 200000},
        {"symbol": "u", "start": 200000, "end": 300000},
        {"symbol": "w", "start": 300000, "end": 350000},
        {"symbol": "a", "start": 350000, "end": 450000},

        {"symbol": "pau", "start": 450000, "end": 750000},

        {"symbol": "t", "start": 750000, "end": 800000},
        {"symbol": "o", "start": 800000, "end": 900000},
        {"symbol": "t", "start": 900000, "end": 950000},
        {"symbol": "e", "start": 950000, "end": 1050000},
        {"symbol": "m", "start": 1050000, "end": 1100000},
        {"symbol": "o", "start": 1100000, "end": 1200000},

        {"symbol": "pau", "start": 1200000, "end": 1300000},

        {"symbol": "i", "start": 1300000, "end": 1400000},
        {"symbol": "i", "start": 1400000, "end": 1500000},

        {"symbol": "pau", "start": 1500000, "end": 1900000},
    ]

    result = estimate_breaks(
        script,
        lipsync,
    )

    print()
    print("=" * 80)
    print("RESULT")
    print("=" * 80)

    for item in result:
        print(item)

    debug_breaks(
        script,
        lipsync,
    )
