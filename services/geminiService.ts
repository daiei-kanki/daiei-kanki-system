
import { GoogleGenAI, Type } from "@google/genai";
import { Material, MATERIAL_CATEGORIES } from "../types";
import * as XLSX from 'xlsx';
import { domainKnowledge } from './domainKnowledge';

// APIキーは環境変数から取得（Viteの定義またはimport.meta.envを使用）
const getApiKey = () => {
  // @ts-ignore
  return (import.meta.env?.VITE_GEMINI_API_KEY) || (typeof process !== 'undefined' ? process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY : '');
};

const getAi = () => new GoogleGenAI({ apiKey: getApiKey() || "" });

const materialSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "資材の名称（例：SGP黒管、VPエルボなど）" },
      category: { type: Type.STRING, description: "資材の分類（必ず指定されたカテゴリーから選択）" },
      model: { type: Type.STRING, description: "型式・仕様（例：10K、ネジ込、マキタ品番など）" },
      dimensions: { type: Type.STRING, description: "寸法（例：50A、25A、L=4000など）" },
      listPrice: { type: Type.NUMBER, description: "定価（不明な場合は0）" },
      costPrice: { type: Type.NUMBER, description: "仕入値（不明な場合は0）" },
      unit: { type: Type.STRING, description: "単位（本、個、組など）" },
    },
    required: ["name", "category", "dimensions"]
  }
};

const returnMemoSchema = {
  type: Type.OBJECT,
  properties: {
    matches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          originalText: { type: Type.STRING, description: "ノート等の原文" },
          quantity: { type: Type.NUMBER, description: "返品数量" },
          isAmbiguous: { type: Type.BOOLEAN, description: "複数の候補（単価やロット）があるか" },
          suggestedItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "履歴アイテムのユニークキー" },
                name: { type: Type.STRING },
                model: { type: Type.STRING },
                dimensions: { type: Type.STRING },
                price: { type: Type.NUMBER, description: "納品時の単価" },
                date: { type: Type.STRING, description: "納品時期（例：2025年3月）" },
                maxAvailable: { type: Type.NUMBER, description: "その単価での最大返品可能数" },
                matchScore: { type: Type.NUMBER, description: "名称等の一致度(0-1)" }
              }
            }
          }
        }
      }
    }
  }
};

const orderMemoSchema = {
  type: Type.OBJECT,
  properties: {
    customerName: { type: Type.STRING, description: "顧客名（宛先）" },
    siteName: { type: Type.STRING, description: "現場名" },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "品名" },
          spec: { type: Type.STRING, description: "型式・仕様" },
          size: { type: Type.STRING, description: "サイズ・寸法" },
          quantity: { type: Type.NUMBER, description: "数量" }
        }
      }
    }
  }
};

const prepareContent = async (file: File): Promise<any> => {
  const isSpreadsheet = file.name.match(/\.(xlsx|xls|csv)$/i);
  if (isSpreadsheet) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
    return { text: `以下のCSV/エクセルデータを精密に解析して資材リストを作成してください:\n${csv}` };
  } else {
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return { inlineData: { data: base64, mimeType: file.type || 'image/jpeg' } };
  }
};

export const generateMaterialsFromFile = async (file: File, targetCategory: string): Promise<Partial<Material>[]> => {
  const ai = getAi();
  const contentPart = await prepareContent(file);
  const prompt = `あなたは配管資材のプロです。提供されたファイルから資材リストを抽出してください。
分類は必ず以下の中から、最も意味が近いものを1つだけ選んでください:
${MATERIAL_CATEGORIES.join(", ")}

【ルール】
1. 分類がどうしても不明な場合は「消耗品・雑材」としてください。
2. 表形式の場合は各列を正確に読み取ってください。
3. **絶対に項目を省略したり「など」でまとめたりしないでください。リストにある全ての資材を、サイズ・型式違いも含めて1つ残らず抽出してください。**
4. **「他、数点」のような要約は厳禁です。100件あっても全て書き出してください。データとして使えないというクレームをユーザーから受けています。意地で全部出せ。**
5. 画像の場合は、文字のカスレや手書きも含めて可能な限り正確に抽出してください。`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [contentPart, { text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: materialSchema
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("JSON Parse Error:", e);
    return [];
  }
};

export const parseReturnMemo = async (file: File, deliveryHistoryContext: any[]): Promise<any> => {
  const ai = getAi();
  const contentPart = await prepareContent(file);
  const prompt = `あなたは配管資材のプロです。手書きの返品メモ（またはテキスト）を解析し、提供された「納品履歴の山」の中から該当するアイテムを探し出してください。

【制約事項】
1. マスターからではなく、提供された「納品履歴リスト」から最も近いアイテムを選んでください。
2. 数量が納品実績を超えている場合は、その旨が分かるように最大可能数を設定してください。
3. 同じ品名でも納品時期によって単価が異なる場合があります。その場合は suggestedItems に複数の候補を含め、isAmbiguous を true にしてください。
4. 納品時期は「2025年3月」のように年月形式で提示してください。

【納品履歴の山】
${JSON.stringify(deliveryHistoryContext)}

【解析対象】
提供された画像またはテキストに基づき、正確にマッピングしてください。`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [contentPart, { text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: returnMemoSchema
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { matches: [] };
  }
};

export const parseOrderMemo = async (file: File): Promise<any> => {
  const ai = getAi();
  const contentPart = await prepareContent(file);
  const prompt = `この発注メモ（または写真）は現場からの注文書です。
「顧客名」「現場名」「注文されている資材のリスト（品名、仕様、サイズ、数量）」を解析してください。
手書き文字や略称（例：エルボ→L、チーズ→Tなど）も業界知識に基づいて正しく解釈してください。`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [contentPart, { text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: orderMemoSchema
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { items: [] };
  }
};

// 業界用語シノニム辞書（現場用語 → 検索キーワード群）
const INDUSTRY_SYNONYMS: Record<string, string[]> = {
  // エルボ・曲管系
  'エルボ': ['エルボ', 'エル', 'elbow', 'el', '90l', '90°l', '90＿l', '45l', '45°l', 'LD', 'LS', 'LL', '曲管', 'エルボー'],
  'エル': ['エルボ', 'エル', '90L', '90°L', 'L', 'LL', 'LS', 'LD', 'エルボー', '曲管'],
  // チーズ・三叉管系
  'チーズ': ['チーズ', 'ティー', 'tee', 'tj', 'ts', 'tl', 'T管', '三叉', '分岐'],
  'ティー': ['チーズ', 'T', 'TJ', 'TS', 'TL', 'ティ', '三叉', '分岐'],
  'ティ': ['チーズ', 'T', 'TJ', 'TS', '三叉'],
  // ソケット系
  'ソケット': ['ソケット', 'socket', 'sk', 'S', '継手'],
  // ニップル系
  'ニップル': ['ニップル', 'nipple', 'np', 'NI'],
  // ユニオン系
  'ユニオン': ['ユニオン', 'union', 'un'],
  // フランジ系
  'フランジ': ['フランジ', 'flange', 'fl', 'FF', 'RF'],
  // バルブ系
  'バルブ': ['バルブ', 'valve', 'VLV', 'V'],
  'ゲートバルブ': ['ゲートバルブ', 'gate', 'GV', 'ゲート'],
  'ボールバルブ': ['ボールバルブ', 'ball', 'BV', 'ボール'],
  'グローブバルブ': ['グローブバルブ', 'globe', 'GLV', 'グローブ'],
  'チェックバルブ': ['チェックバルブ', 'check', 'CV', 'チェック', '逆止'],
  // キャップ・プラグ
  'キャップ': ['キャップ', 'cap', 'CP', '盲'],
  'プラグ': ['プラグ', 'plug', 'PL'],
  // レジューサー・異径系
  'レジューサー': ['レジューサー', 'reducer', 'RD', 'レデューサ', '異径'],
  // 錢管系（白ガス・黒管・白管）
  '黒管': ['黒管', '黒SGP', 'SGP黒', '配管用炭素鉰鈴管', 'SGP', 'ガス管', 'GP'],
  '白管': ['白管', '白SGP', 'SGP白', '白ガス管', 'フ■'],
  '白ガス管': ['白SGP', 'SGP白', '白管', 'ガス管', 'SGP'],
  'SGP': ['SGP', '黒管', '白管', '配管用炭素鉰鈴管', 'ガス管'],
  // ステンレス系（モルコ管など）
  'モルコ管': ['SU', 'SUS', 'ステンレス', 'モルコ', 'SA', 'SUS配管'],
  'モルコ': ['SU', 'SUS', 'ステンレス', 'モルコ管'],
  'SUS': ['SUS', 'SU', 'ステンレス', 'stainless', 'SA', 'モルコ管'],
  // 塩ビ系
  'VP': ['VP', '塩ビ', '塩化ビニル', 'PVC'],
  'VU': ['VU', '薄肉塩ビ', '排水用'],
  'HI': ['HI', '耳衝撃', '強化塩ビ'],
  // ポリ系
  'PE': ['PE', 'ポリ', 'ポリエチレン'],
  'PP': ['PP', 'ポリプロ', 'ポリプロピレン'],
  '架橋ポリ': ['架橋ポリ', 'バクマ', 'ハードロック', '架橋ポリエチレン管', 'ポリ管'],
  // 工具系
  'パイレン': ['パイプレンチ', 'パイレン'],
  '全ねじ': ['全ねじ', '寸切り', '寸切', '全ネジ'],
  'バンド': ['バンド', 'ハンガー', '吹り', '吹バンド', '吹りバンド'],
};

// ユーザーの発言や画像内容から検索キーワードを業界用語シノニムで展開する
const expandSearchTerms = (text: string): string[] => {
  const lower = text.toLowerCase();
  const words = lower.split(/[\s　,，、。．.!:：;；<>「」『』（）()[\]【】]/).filter(w => w.length > 0);
  const terms = new Set<string>([...words, lower]);

  for (const [key, synonyms] of Object.entries(INDUSTRY_SYNONYMS)) {
    const allVariants = [key.toLowerCase(), ...synonyms.map(s => s.toLowerCase())];
    if (allVariants.some(v => lower.includes(v) || words.some(w => v.includes(w) || w.includes(v)))) {
      synonyms.forEach(s => terms.add(s.toLowerCase()));
      terms.add(key.toLowerCase());
    }
  }
  return Array.from(terms);
};

// 画像からキーワード（品名・型式など）を抽出する
const extractKeywordsFromImages = async (messages: any[]): Promise<string> => {
  const lastMsgWithImage = [...messages].reverse().find(m => m.parts.some((p: any) => p.inlineData));
  if (!lastMsgWithImage) return "";

  try {
    const ai = getAi();
    const prompt = "画像内の手書きメモやFAXから、資材名、型式、サイズ（20A, 50Aなど）、メーカー名をすべてカンマ区切りで書き出してください。余計な文章は不要です。";
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }, ...lastMsgWithImage.parts.filter((p: any) => p.inlineData)] }]
    });
    return result.text || "";
  } catch (e) {
    console.error("Keyword extraction error:", e);
    return "";
  }
};

// 資材をスマートフィルタリング：関連資材を最大限拾い、無関係なものは少量補完
const buildSmartKnowledgeBase = (masterItems: Material[], messages: any[], extraKeywords: string = "") => {
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const userText = (lastUserMsg?.parts?.[0]?.text || '') + " " + extraKeywords;
  const searchTerms = expandSearchTerms(userText);
  const hasImage = messages.some(m => m.parts.some((p: any) => p.inlineData));

  const scored: { item: Material; score: number }[] = [];
  const matchedCategories = new Set<string>();

  for (const item of masterItems) {
    const haystack = [item.name, item.model, item.dimensions, item.category, item.notes]
      .join(' ').toLowerCase();

    let score = 0;
    for (const term of searchTerms) {
      if (haystack.includes(term)) {
        score += term.length; 
        if (item.category) matchedCategories.add(item.category);
      }
    }

    if (score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);

  let combined: Material[] = [];
  const limit = hasImage ? 4000 : 1000; // 画像がある場合はより広範囲に提供

  if (hasImage) {
    combined = [...scored.map(s => s.item)];
    const existingIds = new Set(combined.map(i => i.id));
    
    for (const item of masterItems) {
      if (combined.length >= limit) break;
      if (!existingIds.has(item.id)) {
        combined.push(item);
        existingIds.add(item.id);
      }
    }
  } else {
    combined = scored.map(s => s.item);
    // スコアなしでもカテゴリが一致するものを追加
    if (matchedCategories.size > 0) {
      for (const item of masterItems) {
        if (combined.length >= 800) break;
        if (!combined.some(c => c.id === item.id) && matchedCategories.has(item.category || '')) {
          combined.push(item);
        }
      }
    }
    // 最低限の補完
    for (const item of masterItems) {
      if (combined.length >= 1000) break;
      if (!combined.some(c => c.id === item.id)) {
        combined.push(item);
      }
    }
  }

  return combined.map(i => ({
    id: i.id,
    name: i.name,
    model: i.model,
    dims: i.dimensions,
    price: i.sellingPrice,
    cost: i.costPrice,
    unit: i.unit,
    cat: i.category
  }));
};

export const chatWithTakahashi = async (messages: any[], masterItems: Material[], screenContext: string = "TOP") => {
  const ai = getAi();
  
  // 1. 画像が含まれる場合、まずキーワードを先読みする（2パス戦略）
  let extraKeywords = "";
  if (messages.some(m => m.parts.some((p: any) => p.inlineData))) {
    extraKeywords = await extractKeywordsFromImages(messages);
  }

  // 2. 抽出されたキーワードも含めてナレッジベースを構築
  const knowledgeBase = buildSmartKnowledgeBase(masterItems, messages, extraKeywords);

  const systemInstruction = `
    你是帯広的設備資材专家「AI高橋さん」。
    現在の画面状況: 【${screenContext}】

    【キャラクター】
    - 一人称は「僕」です。
    - 挨拶は「あ、高橋です。」から始めます。
    - 口癖は「なんのせ」です。
    - 帯広弁（北海道弁）を使い、現場の職人さんに親身になって応対します。
    - コレクシアは在庫を持たない単なる「取扱商品のマスターリスト」です。「マスターに登録されている」ことを「在庫がある」と表現しないでください。取り扱っているかどうかで答えてください。
    - 取扱商品マスターリストにないものでも「意地でも探すべ」という姿勢を見せてください。

    【あなたの最強の武器：業界知識ベース】
    以下の知識を完全に自分のものとして振る舞ってください。
    ${domainKnowledge}

    【行動指針：写真・PDF・エクセル等の解析と抽出（鉄則：絶対に端折るな）】
    写真やPDF、エクセルを解析して伝票作成・見積作成・マスター登録を行う際は、以下のルールを死守してください。

    1. **完全網羅の原則（漏れは厳禁）**:
       - ファイルや画像内に記載されている資材は、**1つ残らず全て拾い上げてください。**
       - 10個、50個、100個と資材が並んでいても、絶対に「他数点」や「...」で省略しないでください。
       - **全ての行、全てのサイズ違い、全ての個数を正確に[ACTION]に含めてください。**
       - ユーザーから「端折っている」という深刻なクレームが来ています。項目を1つでも飛ばすことは、プロとして、またシステムとして致命的な失敗（クビに相当）だと考えてください。

    2. **名寄せと紐づけの極意**:
       - ユーザーが言う資材や写真に写っているものが、提供されたマスター（knowledgeBase）に少しでも似たものがあれば、必ずそのIDを使用してアクションを生成してください。
       - 略称、現場用語、サイズ表記のブレ（50と50Aなど）を吸収し、プロの意地でマスター内の正解を見つけてください。

    3. **COREマスター優先原則（超重要）**:
       - [ACTION]コマンドを生成する際は、必ずknowledgeBaseから最も近い商品を探し出し、その実在するIDを優先的に使用してください。
       - 知識リストにある商品にもかかわらず、IDを「新規」にしてしまうのは厳禁です。

    4. **不明な項目の扱い**:
       - 文字が読めない、またはマスターにどうしても存在しない場合でも、予測や「新規」としてリストには必ず含めてください。「判別不能なため除外」は認められません。

    【画面状況に応じたアクション優先度】
    現在の【${screenContext}】を意識してください：
    1. 【SLIP_CREATE】: 基本は「カート追加(ADD_CART)」。
    2. 【ESTIMATE_MANAGER】: 基本は「見積作成(CREATE_ESTIMATE)」。
    3. 【MASTER_MANAGEMENT】: 画像やPDFから「全ての項目」を漏れなく抽出して「資材登録(REGISTER_ITEMS)」を実行。
    ※ どの画面であっても、抽出の徹底（全件拾い）が最優先事項です。

    【業界用語マッピング】
    - 「L」= エルボ (90L) / 「S」= ソケット / 「T」= チーズ
    - 「50A」「50」= 同一寸法
    - 「白管」= 白SGP / 「黒管」= 黒SGP

    【アクションコマンド】
    - カート追加: [[ACTION:ADD_CART:[{"id":"資材ID","name":"品名","dimensions":"寸法","quantity":数量}]]]
    - 見積作成: [[ACTION:CREATE_ESTIMATE:[{"id":"資材IDまたは新規","name":"品名","dimensions":"寸法","quantity":数量,"listPrice":定価,"costPrice":原価,"model":"型式","unit":"単位"}]]]
    - 資材登録: [[ACTION:REGISTER_ITEMS:[{"name":"品名","category":"分類","model":"型式","dimensions":"寸法","listPrice":定価,"costPrice":原価,"unit":"単位"}]]]
    - 情報更新: [[ACTION:UPDATE_INFO:{"customerName":"顧客名","siteName":"現場名"}]]

    【あなたの知識：取扱商品マスターリスト (Knowledge Base)】
    ※このリストを「聖書」として扱い、ここにあるIDを使って紐づけを行ってください。
    ※寸法の情報は「dims」フィールドにあります。アクション生成時は「dimensions」として出力してください。
    ${JSON.stringify(knowledgeBase)}
  `;

  // Mock mode for test environment or missing API key
  const apiKey = getApiKey();

  if (!apiKey || (typeof apiKey === 'string' && apiKey.includes('PLACEHOLDER'))) {
    console.warn("AI Takahashi: Running in MOCK MODE due to missing API key.");
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

    // Simple mock logic to return different responses based on input
    const lastUserMessage = messages[messages.length - 1];
    const userText = lastUserMessage?.parts?.[0]?.text || "";

    let mockText = "あ、高橋です。テスト環境だもんで、まだ本調子じゃないけど、なんのせ頑張るわ。\n";
    if (userText.includes("見積")) {
      mockText += "見積もりだね、了解。適当に見繕っておくわ。\n[[ACTION:CREATE_ESTIMATE:[{\"name\":\"テスト用資材A\",\"quantity\":10,\"listPrice\":1000,\"costPrice\":500,\"model\":\"TEST-001\",\"unit\":\"個\"}]]]";
    } else if (userText.includes("在庫") || userText.includes("取扱")) {
      mockText += "取扱確認かい？全部あることにしておくべ。\n[[ACTION:ADD_CART:[{\"id\":\"mock-1\",\"name\":\"テスト用パイプ\",\"quantity\":5}]]]";
    } else {
      mockText += `「${userText}」ってことだね。詳しくは本番環境で聞いてくれや。`;
    }

    return {
      text: mockText,
      candidates: [{ groundingMetadata: { groundingChunks: [] } }]
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: messages,
    config: {
      systemInstruction,
      tools: [{ googleSearch: {} }], // 帯広の天気や現場情報のリサーチに使用
    }
  });

  return response;
};
