from __future__ import annotations

from pathlib import Path
from typing import Sequence

import pyopenjtalk


# ============================================================
# User dictionary
# ============================================================

def _load_user_dictionary() -> None:
    """
    ユーザー辞書が存在する場合は OpenJTalk に読み込む。

    探索順:
        1. このファイルと同じディレクトリ / user.dic
        2. このファイルと同じディレクトリ / userdict/user.dic

    .dic が存在しない場合は何もしない。
    """

    base_dir = Path(__file__).resolve().parent

    candidates = (
        base_dir / "user.dic",
        base_dir / "userdict" / "user.dic",
    )

    for user_dict_path in candidates:

        if not user_dict_path.is_file():
            continue

        pyopenjtalk.update_global_jtalk_with_user_dict(
            str(user_dict_path)
        )

        return


# モジュール読み込み時にユーザー辞書を適用
_load_user_dictionary()


# ============================================================
# LAB phoneme
# ============================================================

# 母音
VOWELS = {
    "a",
    "i",
    "u",
    "e",
    "o",
}

# 撥音「ん」
MORA_N = {
    "N",
    "n",
}

# 促音「っ」
MORA_Q = {
    "q",
    "Q",
    "cl",
}

# LAB側で単独で1モーラになる可能性がある記号
STANDALONE_MORA = MORA_N | MORA_Q


# ============================================================
# TXT → モーラ
# ============================================================

def _count_kana_mora(kana: str) -> int:
    """
    カタカナ読みからモーラ数を数える。

    例:

        コンニチワ
        → 5

        キョウ
        → 2
           キョ / ウ

        ガッコウ
        → 4
           ガ / ッ / コ / ウ

    小書き文字は前の文字と同じモーラとして扱う。
    """

    if not kana:
        return 0

    small_kana = {
        "ァ", "ィ", "ゥ", "ェ", "ォ",
        "ャ", "ュ", "ョ",
        "ヮ",
        "ヵ", "ヶ",
    }

    count = 0

    for ch in kana:

        if ch.isspace():
            continue

        # 小書き文字は前の文字に含める
        if ch in small_kana:
            continue

        # 長音「ー」は1モーラ
        if ch == "ー":
            count += 1
            continue

        # 撥音「ン」
        if ch == "ン":
            count += 1
            continue

        # 促音「ッ」
        if ch == "ッ":
            count += 1
            continue

        # 通常のカタカナ
        count += 1

    return count


def text_to_mora_count(
    text: str,
) -> int:
    """
    日本語テキストをOpenJTalkで読みへ変換し、
    モーラ数を返す。

    ユーザー辞書が存在する場合は、
    モジュール読み込み時に適用された辞書を使用する。
    """

    if not text:
        return 0

    if pyopenjtalk is None:
        raise RuntimeError(
            "pyopenjtalk is required for "
            "mora-based progress calculation."
        )

    kana = pyopenjtalk.g2p(
        text,
        kana=True,
    )

    return _count_kana_mora(kana)


def calculate_script_progress(
    text_before_break: str,
    total_text: str,
) -> float:
    """
    読点までのモーラ進捗を計算する。

    例:

        全体:
            今日はとてもいい天気です

        読点まで:
            今日は

        ↓

        break_mora / total_mora
    """

    total_mora = text_to_mora_count(
        total_text
    )

    if total_mora <= 0:
        return 0.0

    break_mora = text_to_mora_count(
        text_before_break
    )

    return min(
        1.0,
        max(
            0.0,
            break_mora / total_mora,
        ),
    )


# ============================================================
# LAB → モーラ
# ============================================================

def _is_vowel(
    symbol: str,
) -> bool:
    return symbol.lower() in VOWELS


def _is_n(
    symbol: str,
) -> bool:
    return symbol in MORA_N


def _is_q(
    symbol: str,
) -> bool:
    return symbol.lower() in {
        "q",
        "cl",
    }


def count_moras_from_phonemes(
    symbols: Sequence[str],
) -> int:
    """
    OpenJTalk系の音素列から、おおよそのモーラ数を数える。

    基本ルール:

        子音 + 母音
            → 1モーラ

        N
            → 1モーラ

        q / cl
            → 1モーラ
    """

    count = 0

    for symbol in symbols:

        if not symbol:
            continue

        symbol = str(symbol).strip()

        if not symbol:
            continue

        # pau / sil / sp は発話モーラではない
        if symbol.lower() in {
            "pau",
            "sil",
            "sp",
        }:
            continue

        # 撥音
        if _is_n(symbol):
            count += 1
            continue

        # 促音
        if _is_q(symbol):
            count += 1
            continue

        # 母音が出たところで1モーラ完成
        if _is_vowel(symbol):
            count += 1
            continue

    return count


def calculate_lab_mora_progress(
    symbols_before_pau: Sequence[str],
    all_symbols: Sequence[str],
) -> float:
    """
    LAB上のpau位置を、モーラ進捗として計算する。

    時間は一切使用しない。
    """

    total_mora = count_moras_from_phonemes(
        all_symbols
    )

    if total_mora <= 0:
        return 0.0

    current_mora = count_moras_from_phonemes(
        symbols_before_pau
    )

    return min(
        1.0,
        max(
            0.0,
            current_mora / total_mora,
        ),
    )


# ============================================================
# フォールバック
# ============================================================

def calculate_sequence_progress(
    index: int,
    count: int,
) -> float:
    """
    モーラ数を計算できない場合の
    順序ベースのフォールバック。
    """

    if count <= 0:
        return 0.0

    return (index + 1) / count
