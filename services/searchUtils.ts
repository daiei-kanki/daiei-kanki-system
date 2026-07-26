
import { MaterialItem, PricingRule } from '../types';

// 高速化のためのキャッシュ
const normalizationCache = new Map<string, string>();
const strictNormalizationCache = new Map<string, string>();

/**
 * Natural comparison function that handles numbers within strings correctly.
 * Useful for sorting sizes like 15, 20, 25, 100, etc.
 */
export const naturalCompare = (a: string, b: string): number => {
    const extract = (s: string) => {
        // Normalize text: replace full-width characters and separate numbers from text
        const normalized = s.replace(/[０-９]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xfee0))
                            .replace(/[×*xＸ]/g, ' x ');
        
        // Match numbers and non-number chunks
        const chunks = normalized.match(/(\d+|\D+)/g) || [];
        return chunks.map(chunk => {
            const num = parseInt(chunk, 10);
            return isNaN(num) ? chunk.toLowerCase() : num;
        });
    };

    const chunksA = extract(a);
    const chunksB = extract(b);

    for (let i = 0; i < Math.max(chunksA.length, chunksB.length); i++) {
        const valA = chunksA[i];
        const valB = chunksB[i];

        if (valA === undefined) return -1;
        if (valB === undefined) return 1;

        if (typeof valA === 'number' && typeof valB === 'number') {
            if (valA !== valB) return valA - valB;
        } else if (typeof valA === 'string' && typeof valB === 'string') {
            const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            if (cmp !== 0) return cmp;
        } else {
            // Numbers come before strings
            return typeof valA === 'number' ? -1 : 1;
        }
    }

    return 0;
};

/**
 * Normalizes text for search by:
 * 1. Converting Hiragana to Katakana
 * 2. Converting Full-width alphanumeric characters to Half-width
 * 3. Converting Half-width Katakana to Full-width Katakana
 * 4. Converting to lowercase
 * 5. Normalizing dashes and hyphens
 * 6. Trimming whitespace
 */
export const normalizeForSearch = (text: string): string => {
    if (!text) return '';
    if (normalizationCache.has(text)) return normalizationCache.get(text)!;
    
    let normalized = text.trim();

    // 1. Hiragana to Katakana
    normalized = normalized.replace(/[\u3041-\u3096]/g, (match) => {
        const chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });

    // 2. Full-width alphanumeric/symbols to Half-width
    normalized = normalized.replace(/[！-～]/g, (match) => {
        return String.fromCharCode(match.charCodeAt(0) - 0xfee0);
    });

    // 3. Half-width Katakana to Full-width Katakana
    const kanaMap: Record<string, string> = {
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
        'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
        'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
        'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
        'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
        'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
        'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
        'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
        'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
        'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
        'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
        'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
        'ﾞ': '゛', 'ﾟ': '゜', 'ｰ': 'ー'
    };
    normalized = normalized.replace(/[ｦ-ﾟ]/g, (match) => kanaMap[match] || match);

    // 4. Combining Dakuten/Handakuten
    normalized = normalized.replace(/カ゛/g, 'ガ').replace(/キ゛/g, 'ギ').replace(/ク゛/g, 'グ').replace(/ケ゛/g, 'ゲ').replace(/コ゛/g, 'ゴ')
                           .replace(/サ゛/g, 'ザ').replace(/シ゛/g, 'ジ').replace(/ス゛/g, 'ズ').replace(/セ゛/g, 'ゼ').replace(/ソ゛/g, 'ゾ')
                           .replace(/タ゛/g, 'ダ').replace(/チ゛/g, 'ヂ').replace(/ツ゛/g, 'ヅ').replace(/テ゛/g, 'デ').replace(/ト゛/g, 'ド')
                           .replace(/ハ゛/g, 'バ').replace(/ヒ゛/g, 'ビ').replace(/フ゛/g, 'ブ').replace(/ヘ゛/g, 'ベ').replace(/ホ゛/g, 'ボ')
                           .replace(/ハ゜/g, 'パ').replace(/ヒ゜/g, 'ピ').replace(/フ゜/g, 'プ').replace(/ヘ゜/g, 'ペ').replace(/ホ゜/g, 'ポ')
                           .replace(/ウ゛/g, 'ヴ');

    // 5. Lowercase
    normalized = normalized.toLowerCase();

    // 6. Unify hyphens/dashes to "-"
    // NOTE: 文字クラス内で「－-」と書くと U+FF0D〜U+002D の範囲指定になり無効なため、
    //       各文字を個別にリストアップする
    normalized = normalized.replace(/[ーｰ－‐‑‒–—―⁃\-]/g, '-');

    // 7. Space normalization
    normalized = normalized.replace(/　/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ');

    const result = normalized.trim();
    normalizationCache.set(text, result);
    return result;
};

const strictNorm = (s: string): string => {
    if (!s) return '';
    if (strictNormalizationCache.has(s)) return strictNormalizationCache.get(s)!;

    let n = normalizeForSearch(s);
    // Remove corporate suffixes
    n = n.replace(/株式会社|有限会社|合同会社|合資会社|合名会社|（株）|\(株\)|㈱|（有）|\(有\)|㈲|（合）|（名）/g, '');
    // Remove all non-alphanumeric/Japanese characters
    const result = n.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '');
    strictNormalizationCache.set(s, result);
    return result;
};

// Cache for customer-specific rules to avoid repeated filtering
let lastPricingRules: PricingRule[] | null = null;
let customerRulesCache = new Map<string, PricingRule[]>();

/**
 * Calculates applied price based on customer and site rules.
 * Optimized for high performance with caching.
 */
export const getAppliedPrice = (item: MaterialItem, activeCustomer: string | null, activeSite: string | null, pricingRules: PricingRule[]): number => {
    const basePrice = item.sellingPrice || 0;
    if (!activeCustomer || !pricingRules || pricingRules.length === 0) return basePrice;

    // Clear cache if the source rules array has changed
    if (pricingRules !== lastPricingRules) {
        customerRulesCache.clear();
        normalizationCache.clear();
        strictNormalizationCache.clear();
        lastPricingRules = pricingRules;
    }

    // Pre-filter rules for the current customer (cached)
    let customerRules = customerRulesCache.get(activeCustomer);
    if (!customerRules) {
        const sc = strictNorm(activeCustomer);
        customerRules = pricingRules.filter(r => {
            const rSc = strictNorm(r.customerName);
            // 1. 完全一致 2. ルール名が顧客名に含まれる 3. 顧客名がルール名に含まれる
            return rSc === sc || (rSc.length > 2 && sc.includes(rSc)) || (sc.length > 2 && rSc.includes(sc));
        });
        customerRulesCache.set(activeCustomer, customerRules);
    }

    if (customerRules.length === 0) return basePrice;

    const findBestRule = (scopeRules: PricingRule[]) => {
        // 1. Exact Material ID Match
        let r = scopeRules.find(r => r.materialId === item.id);
        if (r) return r;

        // 2. Name + Category + Model + Dimensions Match (very specific)
        const normName = normalizeForSearch(item.name);
        const normCat = normalizeForSearch(item.category);
        const normModel = normalizeForSearch(item.model || '');
        const normDims = normalizeForSearch(item.dimensions || '');
        
        r = scopeRules.find(r => 
            normalizeForSearch(r.materialName || '') === normName &&
            normalizeForSearch(r.category) === normCat &&
            normalizeForSearch(r.model || '') === normModel &&
            normalizeForSearch(r.dimensions || '') === normDims
        );
        if (r) return r;

        // 3. Name + Category + Model Match
        r = scopeRules.find(r => 
            normalizeForSearch(r.materialName || '') === normName &&
            normalizeForSearch(r.category) === normCat &&
            normalizeForSearch(r.model || '') === normModel
        );
        if (r) return r;

        // 3. Category + Model Match
        if (item.model) {
            r = scopeRules.find(r => 
                normalizeForSearch(r.category) === normCat && 
                normalizeForSearch(r.model || '') === normModel && 
                !r.materialId
            );
            if (r) return r;
        }

        // 4. Category Match (model: 'All')
        r = scopeRules.find(r => 
            normalizeForSearch(r.category) === normCat && 
            (!r.model || r.model === 'All' || r.model === '') && 
            !r.materialId
        );
        return r;
    };

    // Site common check
    const isCommonSite = (siteName: string | undefined | null) => {
        if (!siteName) return true;
        const norm = normalizeForSearch(siteName);
        return norm === '' || norm === 'キョウツウ' || norm === 'ゼンゲンジャウキョウツウ' || norm === 'イッパン';
    };

    // Priority: 1. Site-specific rule, 2. Customer-common rule
    let rule: PricingRule | undefined;
    if (activeSite && activeSite !== '' && !isCommonSite(activeSite)) {
        const normSite = normalizeForSearch(activeSite);
        const siteRules = customerRules.filter(r => !isCommonSite(r.siteName) && normalizeForSearch(r.siteName || '') === normSite);
        rule = findBestRule(siteRules);
    }

    if (!rule) {
        const commonRules = customerRules.filter(r => isCommonSite(r.siteName));
        rule = findBestRule(commonRules);
    }

    if (rule) {
        if (rule.method === 'fixed_price') {
            return rule.value;
        } else if (rule.method === 'percent_of_list' && item.listPrice > 0) {
            return Math.round(item.listPrice * (rule.value / 100));
        } else if (rule.method === 'markup_on_cost' && item.costPrice > 0) {
            return Math.round(item.costPrice * (1 + (rule.value / 100)));
        }
    }

    return basePrice;
};

/**
 * Calculates a match-quality score for a single term against a field value.
 * Higher score = better match.
 *   4: exact full match
 *   3: word-boundary match (term appears as a standalone word/token)
 *   2: starts-with match (field starts with term)
 *   1: substring match
 *   0: no match
 *
 * "Word boundary" here means the character before/after the term is
 * not alphanumeric or Japanese, so "T" won't score 3 against "LT".
 */
const termScore = (field: string, term: string): number => {
    if (!field.includes(term)) return 0;
    if (field === term) return 4;

    // Word-boundary check using surrounding characters
    const idx = field.indexOf(term);
    const before = idx > 0 ? field[idx - 1] : ' ';
    const after = idx + term.length < field.length ? field[idx + term.length] : ' ';
    const isBoundaryChar = (c: string) => /[\s\-_\/×x・,.()\[\]{}]/.test(c) || !/[a-z0-9\u3040-\u30ff\u4e00-\u9fff]/.test(c);
    if (isBoundaryChar(before) && isBoundaryChar(after)) return 3;

    if (field.startsWith(term)) return 2;
    return 1;
};

/**
 * Computes the total relevance score for an item against all search terms.
 * Returns null if any term is not matched at all (filter-out).
 */
const itemRelevanceScore = (item: MaterialItem, terms: string[]): number | null => {
    const fields = [
        normalizeForSearch(item.name),
        normalizeForSearch(item.category),
        normalizeForSearch(item.model || ''),
        normalizeForSearch(item.manufacturer || ''),
        normalizeForSearch(item.location || ''),
        normalizeForSearch(item.dimensions || ''),
        normalizeForSearch(item.size || ''),
    ];

    let totalScore = 0;
    for (const term of terms) {
        const best = Math.max(...fields.map(f => termScore(f, term)));
        if (best === 0) return null; // term not found → filter out
        totalScore += best;
    }
    return totalScore;
};

/**
 * Filter and sort items based on multiple search terms.
 * Scoring priority per term: exact(4) > word-boundary(3) > starts-with(2) > substring(1).
 * This prevents "LT" / "RT" from outranking a lone "T" search.
 */
export const filterAndSortItems = (items: MaterialItem[], searchTerms: string): MaterialItem[] => {
    if (!searchTerms.trim()) return items;

    const terms = searchTerms.split(/\s+/).map(t => normalizeForSearch(t)).filter(t => t.length > 0);

    const scored: Array<{ item: MaterialItem; score: number }> = [];
    for (const item of items) {
        const score = itemRelevanceScore(item, terms);
        if (score !== null) {
            scored.push({ item, score });
        }
    }

    scored.sort((a, b) => {
        // Higher relevance score first
        if (b.score !== a.score) return b.score - a.score;

        // Tie-break: natural sort by name + model + dimensions
        const aFull = `${normalizeForSearch(a.item.name)} ${normalizeForSearch(a.item.model || '')} ${normalizeForSearch(a.item.dimensions || '')}`;
        const bFull = `${normalizeForSearch(b.item.name)} ${normalizeForSearch(b.item.model || '')} ${normalizeForSearch(b.item.dimensions || '')}`;
        return naturalCompare(aFull, bFull);
    });

    return scored.map(s => s.item);
};
