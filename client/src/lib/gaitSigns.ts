/**
 * 動作分析サインの「左右 × 強弱」の選択状態と、foot_analyses.detected_signs(text[])との相互変換。
 *
 * 2026-09-19 冨永社長指示: 従来は「左 / 右 / 両側」の有無(0/1)しか表せなかったため、
 * 「左に少しある(弱)」と「左に明らかにある(強)」を区別できるよう、左弱・左強・右弱・右強の
 * 4ボタンに変更した。左と右は独立に選べる(=旧「両側」は左右とも選ぶことで表現するため廃止)。
 *
 * 表示記号(2026-09-19 冨永社長指定): 弱 = 「±」(あるかどうか曖昧・わずかにある)、強 = 「+」(明らかにある)。
 *   内部の保存値は left_weak / left_strong のまま(記号は表示だけ)。
 *
 * 保存形式(detected_signs の各要素は "サインkey:側"):
 *   新: "shoulder_swing:left_weak" / ":left_strong" / ":right_weak" / ":right_strong"
 *       左右とも選んだ場合は2要素("key:left_strong" と "key:right_weak" など)
 *       左右の概念が無いサイン(no_arm_swing 等)は従来どおり "key:both"
 *   旧: "key:left" / "key:right" / "key:both"(強弱導入前に保存された分。読み取りは継続対応)
 *
 * 旧形式の読み込み時の扱い: 旧UIで側を選んでいた = 「明らかにある」と判断していたはずなので、
 *   編集フォーム上は「強」として読み込む(結果サマリーの表示は旧ラベル「左」「右」のまま変えない)。
 *   Greenはローンチ前でテストデータのみのため実害は無いが、この既定を変える場合はここを直す。
 */
export type Level = "weak" | "strong";

export interface SignSel {
  left: Level | null;
  right: Level | null;
  /** 左右の概念が無いサイン(チェックボックス型)用 */
  check: boolean;
}

export const EMPTY_SEL: SignSel = { left: null, right: null, check: false };

const SIDE_LABEL: Record<string, string> = {
  left_weak: "左±",
  left_strong: "左+",
  right_weak: "右±",
  right_strong: "右+",
  left: "左",
  right: "右",
  both: "両側",
};

/** detected_signs の「側」部分から表示用ラベルを返す(旧形式も対応) */
export function sideLabel(side: string): string {
  return SIDE_LABEL[side] ?? side;
}

/** detected_signs → サインkeyごとの選択状態(編集フォーム用) */
export function parseDetected(
  entries: string[] | null | undefined,
  checkOnlyKeys: Set<string>
): Record<string, SignSel> {
  const result: Record<string, SignSel> = {};
  for (const entry of entries ?? []) {
    const [key, side] = entry.split(":");
    if (!key || !side) continue;
    const cur = result[key] ?? { ...EMPTY_SEL };
    if (checkOnlyKeys.has(key)) {
      cur.check = true;
    } else if (side === "left_weak") cur.left = "weak";
    else if (side === "left_strong" || side === "left") cur.left = "strong";
    else if (side === "right_weak") cur.right = "weak";
    else if (side === "right_strong" || side === "right") cur.right = "strong";
    else if (side === "both") {
      // 旧「両側」= 左右とも
      cur.left = "strong";
      cur.right = "strong";
    }
    result[key] = cur;
  }
  return result;
}

/** 選択状態 → detected_signs(保存用) */
export function toEntries(
  selections: Record<string, SignSel>,
  checkOnlyKeys: Set<string>
): string[] {
  const out: string[] = [];
  for (const [key, sel] of Object.entries(selections)) {
    if (checkOnlyKeys.has(key)) {
      if (sel.check) out.push(`${key}:both`);
      continue;
    }
    if (sel.left) out.push(`${key}:left_${sel.left}`);
    if (sel.right) out.push(`${key}:right_${sel.right}`);
  }
  return out;
}

/** detected_signs をサインkeyごとにまとめ、表示用ラベル(例: ["左強","右弱"])にする。keyの初出順を保つ。 */
export function groupDetectedLabels(entries: string[] | null | undefined): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const entry of entries ?? []) {
    const [key, side] = entry.split(":");
    if (!key || !side) continue;
    const list = map.get(key) ?? [];
    list.push(sideLabel(side));
    map.set(key, list);
  }
  return map;
}
