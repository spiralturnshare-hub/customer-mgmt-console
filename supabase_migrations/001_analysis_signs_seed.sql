-- ============================================================
-- analysis_signs への region 列追加 + Glideスクリーンショットからの初期データ投入
-- 実行方法: Supabase SQL Editor に貼り付けて手動実行してください(AIは実行しません)
-- 注意: これはGlideスクリーンショットからの一次データです。正式なスプレッドシートと
--       突き合わせて確認・修正してください(特に p_analytics/p_measure/howto/caution/
--       frequency/image_url/point は未入力・仮値です)。
-- ロールバック: 末尾のROLLBACK用SQLを参照
-- ============================================================

-- 1. region列が無ければ追加(体幹骨盤/腕/脚/足部の部位グルーピング用)
ALTER TABLE analysis_signs ADD COLUMN IF NOT EXISTS region text;

-- 2. 初期データ投入(スクリーンショット記載順・display_indexで並び順維持)
--    side列: DBのCHECK制約により '左'/'右'/'両側'/'-' のいずれかのみ許可される。
--    ただし本来の用途(1行=1サインなのに単一値しか持てない)が不明なため、
--    ひとまず全行 '-' を投入する。左右/両側どのボタンを画面に出すかは
--    フロントエンド側のコードで例外リストとして管理する(GaitAnalysis.tsx参照)。
INSERT INTO analysis_signs (key, side, region, header, title, p_measure, display_index) VALUES
  ('shoulder_swing',        '-',  '体幹・骨盤', '肩の揺れ',                 'ショルダーSwingサイン',                              'ドゥシャンヌ歩行を検出', 1),
  ('hip_sway',               '-',  '体幹・骨盤', '骨盤の横ブレ',             'ヒップSWAY',                                        '立脚時の全額面の揺れを抽出。多い場合にチェック', 2),
  ('pelvic_drop',            '-',  '体幹・骨盤', '骨盤の振り出し側への落下',  '骨盤落下（トレンデレンブルグ兆候）',                 '立脚時の遊脚側への骨盤の自由落下様な動きを抽出', 3),
  ('hip_shake',              '-',  '体幹・骨盤', '骨盤の前後のブレ',         'ヒップShake',                                       '伸展相での骨盤後方の引けを抽出', 4),
  ('standing_wobble',        '-',  '体幹・骨盤', '立脚時のふらつき',         '立脚時のふらつき',                                   '立脚側の律動的な放物線軌道を逸脱した重心移動', 5),
  ('palm_sign',              '-',  '腕',        '巻き肩・猫背',             'パームサイン',                                       '後方から手のひらが見えたらチェック', 6),
  ('single_arm_swing',       '-',  '腕',        '腕の振り',                 'シングルアームスイング',                             '極端な振りの左右差を抽出。少ない方をチェック', 7),
  ('no_arm_swing',           '-',  '腕',        '下半身と上半身の運動性',    'ノーアームスイングサイン',                           '腕の振りが極端にない場合チェック', 8),
  ('knee_in',                '-',  '脚',        '膝が痛くなりやすい体重の乗せ方', 'Knee in',                                       '立脚時のKnee inを検出', 9),
  ('knee_lateral_thrust',    '-',  '脚',        '足裏の小指側で歩いている',  'ひざラテラルスラスト',                               'ラテラルスラスト。立脚時のラテラルスラストを抽出', 10),
  ('hip_internal_rotation',  '-',  '脚',        '股関節周りの筋力低下を招きやすい体重の乗せ方', '股関節内旋絞り込み荷重',              '立脚時、膝の裏が外側に向くこと（股関節内旋）を抽出', 11),
  ('knee_over_extension',    '-',  '脚',        '膝過伸展歩行',             'ひざ過伸展歩行（後方ひざ押し付け、競歩型）knee over extension(Kee OE)', '立脚時の膝の過伸展、後方押し付けを抽出', 12),
  ('too_many_toe',           '-',  '足部',      '土踏まずが潰れている',      'Too many toeサイン＆距骨内側飛び出し',               '後方から見て踵骨外側から足指が4本以上見えている、または舟状骨部に著明な凸部が認められる', 13),
  ('lateral_edge_sign',      '-',  '足部',      '過回外歩行',               '足外側エッジサイン',                                'MSで足が回外、または外側COP変位を抽出', 14),
  ('floating_toe_gait',      '-',  '足部',      '浮指歩行',                 '浮指歩行（前方への重心移動の遅延）',                 'MSでいずれかの足趾の踏み込みが見られない、不十分、または一度設置した後に再度浮上する', 15),
  ('medial_whip',            '-',  '足部',      '蹴り出しの方向',           '内側ホイップ',                                      '親指内側での蹴り出しを検出', 16),
  ('intoeing_gait',          '-',  '足部',      '股関節の内側捻れ',         '内股歩き＆足外側蹴り出し',                           '立脚でつま先が内側に向いている方をチェック', 17),
  ('sole_area_compare',      '-',  '足部',      '蹴り出しの強さ',           '足裏面積比べ',                                      '後方から足裏の面積を観察。少ない方をチェック', 18)
ON CONFLICT (key) DO NOTHING;

-- 「【削除予定】歩きはじめの足」は本人よりGlide上で削除予定と明言されたため、意図的に投入対象から除外しています。

-- ============================================================
-- ロールバック用SQL(投入前に戻す場合)
-- ============================================================
-- DELETE FROM analysis_signs WHERE key IN (
--   'shoulder_swing','hip_sway','pelvic_drop','hip_shake','standing_wobble',
--   'palm_sign','single_arm_swing','no_arm_swing','knee_in','knee_lateral_thrust',
--   'hip_internal_rotation','knee_over_extension','too_many_toe','lateral_edge_sign',
--   'floating_toe_gait','medial_whip','intoeing_gait','sole_area_compare'
-- );
-- ALTER TABLE analysis_signs DROP COLUMN IF EXISTS region;
