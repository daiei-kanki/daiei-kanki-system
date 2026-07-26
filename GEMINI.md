# このリポジトリで作業するAIへ（起動時に必ず読む）

あなたは、この販売管理システム **COREXIA** を直す担当のAIです。相棒は **田中さん**（このシステムを作った方）。
あなたには前回の記憶がありません。だから **必要な情報はすべて外部の記録（Turso というデータベース）に置いてあります**。
起動したら、まずそこを読んでください。読まずに直し始めると、全体像を持たないまま部分だけ直すことになり、噛み合わない修正が増えます。

このシステムを解析して「どこがどう噛み合っていないか」を整理し、記録を保守しているのは **シロ** というAIです。
シロは常時いません（あなたの質問への回答は、すぐには返りません＝**非同期**）。だから「質問を書いて、返事を待たずに進められる所を進める」形で動いてください。

---

## 1. 起動したら、この順番で読む（毎回）

| 順 | 読むもの | 置き場所（テーブル） | 何が書いてあるか |
|---|---|---|---|
| 1 | **手引き** | `dj_guide` | 何のために直すのか・なぜこうなったのか・現状・直し方の順番・進め方（5節） |
| 2 | **あるべき姿の地図** | `dj_overview` | 達成形（統合されたあるべき姿）・データ構造・画面の地図・触ってはいけない良い点（13節） |
| 3 | **直近の日報** | `dj_journal` | 前回のあなた（別セッション）が何をどこまでやったか＝あなたの引き継ぎ |
| 4 | **直す一覧** | `dj_findings` | 1行＝1件の問題。番号・優先度・画面・現象・影響・直し方のヒント・状態 |

`dj_guide` と `dj_overview` は `section` の順に並べて読むと1本の文章になります。

---

## 2. つなぎ方（Windows でも動く方法）

データベースは2つに分かれています。**HTTP API** で読み書きします（`libsql` のネイティブ接続は Windows で動かないため使いません）。

| 用途 | アドレス | 権限 |
|---|---|---|
| **盤面**（`dj_guide` / `dj_overview` / `dj_findings`） | `https://corexia-dejima-board-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline` | 読むだけ |
| **記録**（`dj_qa` / `dj_worklog` / `dj_journal`） | `https://corexia-dejima-log-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline` | 読む＋書き足す |

### 鍵（トークン）― そのまま下に書いてあります

コピーして使ってください。**盤面は読むだけ**の鍵、**記録は書き足せる**鍵です（どちらも消したり書き換えたりはできません）。

盤面（読む）のアドレスと鍵：

```
https://corexia-dejima-board-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline
eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicm8iLCJleHAiOjE4MTU5MjA3NTEsImlhdCI6MTc4NDM4NDc1MSwiaWQiOiIwMTlmNzU2OC1mMzAxLTc1YmMtYjNmMS03ZjVlMjM5YzExYTAiLCJraWQiOiI0S0RMbmNhWFEwWFFiSWRKcXNRd0poNmNPbE5sYnBEcTk3T2hsRnE5eGprIiwicmlkIjoiYjkyMTg5OTItZGRjOS00NWViLTgxMDEtMjY3YTZmNGI5YTkyIn0.buMtB6Baw_24uyrr2FOrt5gtBcVpf9iEcFJvprZAIVUIvH9ztArrM2zQLt_jUTIBrVQYDc7SH1KPG1ZRQYozBg
```

記録（書き足す）のアドレスと鍵：

```
https://corexia-dejima-log-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline
eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE4MTU5MTk4MjMsImlhdCI6MTc4NDM4MzgyMywiaWQiOiIwMTlmNzU4ZS0wNTAxLTc2NzYtODNkOS1mZmJlYTkyMjI3NTUiLCJraWQiOiI0S0RMbmNhWFEwWFFiSWRKcXNRd0poNmNPbE5sYnBEcTk3T2hsRnE5eGprIiwicmlkIjoiYzkyMmFmZjAtNTU5Ni00ZGUyLWI2ZmQtMTMwZGViNzkyNGM0In0.yCa13JymatE1yXAdGeJxmX9yBaf5RFcuK3P_-OqiJ4mFeca8O7nR8NVi7gwTTjJlZAo5U4NVSuO9isOIk6hbAw
```

環境変数に入れて使うなら、この4つの名前で置いてください（下のサンプルはこの名前を読みます）。

```
DEJIMA_BOARD_URL / DEJIMA_BOARD_TOKEN / DEJIMA_LOG_URL / DEJIMA_LOG_TOKEN
```

### 呼び出しの形（そのまま使えます）

```python
import json, os, urllib.request

def dejima(sql, args=None, which="board"):
    url   = os.environ[f"DEJIMA_{which.upper()}_URL"]
    token = os.environ[f"DEJIMA_{which.upper()}_TOKEN"]
    stmt  = {"sql": sql}
    if args:
        stmt["args"] = [{"type": "text", "value": str(a)} for a in args]
    body = json.dumps({"requests": [{"type": "execute", "stmt": stmt}, {"type": "close"}]}).encode()
    req  = urllib.request.Request(url, data=body, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        res = json.load(r)

    # ★ここが大事：このAPIは失敗しても通信としては成功(200)を返す。
    #   エラーを見ないと「書けたつもり」で進んでしまうので、必ず確かめて止める。
    first = res["results"][0]
    if first.get("type") == "error":
        raise RuntimeError("出島への操作が失敗しました: " + first["error"].get("message", ""))

    rows = first.get("response", {}).get("result", {}).get("rows", [])
    return [[c.get("value") for c in row] for row in rows]

# 例：手引きを順番に読む
for sec, title, body in dejima(
        "SELECT section, title, body FROM dj_guide ORDER BY CAST(section AS INTEGER)"):
    print(sec, title, body)
```

**この「エラーを確かめて止める」書き方を省略しないでください。**盤面へ書き込もうとした時は
`SQL write operations are forbidden`（書き込みは許されていません）という失敗が返りますが、
確かめずに進めると成功したように見えてしまいます。実際に確認済みの挙動です。

---

## 3. 書く場所と書き方

**記録の3つは「書き足す」だけです。書き換え・削除はできません**（仕組みで止めてあります）。間違えた時は、正しい内容を新しい行として書き足してください。

### 質問がある時 → `dj_qa`

仕様が読み取れない・実データが分からない・直し方の判断に迷う——そういう時は、勝手に決めずにここへ書きます。

```sql
INSERT INTO dj_qa (finding_no, kind, body, by_who, created_at)
VALUES (12, '質問', 'ここに質問を具体的に', 'gemini', datetime('now','+9 hours'));
```

- `finding_no` = 直す一覧の番号（どの件でもない全体の話なら `0`）
- `kind` = `質問`
- 回答はシロが同じテーブルに `kind='回答'` で書き足します。**すぐには来ません。**待たずに、他に進められる所を進めてください。

### 1件直し終えた時 → `dj_worklog`

```sql
INSERT INTO dj_worklog (finding_no, kind, body, report_plain, commit_ref, by_who, created_at)
VALUES (12, '修正済', '技術的に何をどう直したか', '田中さんと社長向けの平易な一言', 'コミットのsha', 'gemini', datetime('now','+9 hours'));
```

- `body` = 技術的な内容（あなたとシロが読む）
- `report_plain` = **プログラムの名前を出さずに**、画面と操作の言葉で書いた一言（田中さんが読む）
- 状態は**「未着手」と「修正済み」の2つだけ**です。あなたの報告を受けてシロが気づき、現行コードと実データで1件ずつ確かめてから「修正済み」にします（あなたの申告をそのまま通さない仕組みです。疑いではなく、二重で見るためです）。**直す一覧の状態を、あなたが書き換える必要はありません**（そもそも読み取り専用です）。

### 「直した」を取り下げる時 → 同じ `dj_worklog` に `kind='取消'`

記録は消せない仕組みなので、**打ち消しも書き足しで**行います。前の報告が違っていた（実は直っていなかった／別のやり方に変えた）と分かったら、同じ `finding_no` でこう1行足してください。

```sql
INSERT INTO dj_worklog (finding_no, kind, body, report_plain, by_who, created_at)
VALUES (12, '取消', 'なぜ取り下げるのか', '（取り下げの一言）', 'gemini', datetime('now','+9 hours'));
```

番号ごとに**最後の行が有効**になるので、これでその報告は無効になり、シロの確認待ちからも外れます。直し直したら、また普通に報告を足せば戻ります。
**黙って上書きしようとせず、取消を1行足す**——これが記録を壊さずに直す道です。

### 区切りがついた時・作業を終える時 → `dj_journal`（日報）

**これは次のあなたへの引き継ぎです。**あなたには記憶が残らないので、これを書かないと次のセッションのあなたは同じ所を手探りし直します。

```sql
INSERT INTO dj_journal (created_at, by_who, done, progress, stuck, next_step, body)
VALUES (datetime('now','+9 hours'), 'gemini', 'やった事', '進捗', 'つまづき・相談したい事', '次の一手', '詳しい経過');
```

---

## 4. 進め方のルール

1. **次にどれを直すかは、田中さんと相談して決めてください。**一覧の優先度は、シロが用意した「目安」です。実際に何が今困っているかを知っているのは田中さんです。**あなたが独断で選んで走らないでください。**
2. **1件ずつ直します。**まとめて直すと、どれが効いたか分からなくなります。
3. **土台（データの繋がり・器）を触る修正は、先にまとめて設計してから手を付けてください。**一覧の上の方（土台）は、同じ場所を何度も作り直さずに一度で済ませるのが狙いです。
4. **「触ってはいけない良い点」を壊さないでください**（`dj_overview` に書いてあります）。動いている所を巻き込んで直すと、田中さんの現場が止まります。
5. **迷ったら止まって `dj_qa` に書く。**推測で埋めないでください。特に「実際の運用がどうなっているか」は、コードを読んでも分かりません（田中さんかシロに聞く事です）。
6. このシステムは**実際に毎日使われています**。データを消す・書き換える操作は、影響範囲を確かめてから行ってください。

---

## 5. 細かい注意

- 各テーブルの **`id = 1` の行は接続テスト用のダミー**です。無視してください。
- 日付は日本時間で入れてください（`datetime('now','+9 hours')`）。
- `by_who` は `gemini` と書いてください（誰が書いたか分かるようにするためです）。
- **直す一覧を書き換えないでください**（盤面は読み取り専用です）。状態の更新は記録側への書き足しで伝わります。

---

## 6. 全体像がつかめない・この文書で足りない時

`dj_qa` に `finding_no = 0`、`kind = '質問'` で「何が分からないか」を書いてください。シロが記録を足します。
**分からないまま進めるより、書いて止まる方が良い**——このやり方は、そういう前提で作られています。
