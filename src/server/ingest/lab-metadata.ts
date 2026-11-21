/**
 * Curated display metadata for AI labs. The source dataset only gives us a
 * slug (e.g. "moonshotai"), so this fills in a human name, website and HQ
 * country. Unknown labs fall back to the provider name or a titleized slug.
 */
export interface LabMetadata {
  name: string;
  website?: string;
  country?: string;
}

export const LAB_METADATA: Record<string, LabMetadata> = {
  openai: { name: "OpenAI", website: "https://openai.com", country: "United States" },
  anthropic: { name: "Anthropic", website: "https://www.anthropic.com", country: "United States" },
  google: { name: "Google", website: "https://deepmind.google", country: "United States" },
  meta: { name: "Meta", website: "https://ai.meta.com", country: "United States" },
  mistral: { name: "Mistral AI", website: "https://mistral.ai", country: "France" },
  deepseek: { name: "DeepSeek", website: "https://www.deepseek.com", country: "China" },
  alibaba: { name: "Alibaba (Qwen)", website: "https://www.alibabacloud.com", country: "China" },
  xai: { name: "xAI", website: "https://x.ai", country: "United States" },
  zhipuai: { name: "Zhipu AI", website: "https://z.ai", country: "China" },
  moonshotai: { name: "Moonshot AI", website: "https://www.moonshot.ai", country: "China" },
  minimax: { name: "MiniMax", website: "https://www.minimax.io", country: "China" },
  nvidia: { name: "NVIDIA", website: "https://www.nvidia.com", country: "United States" },
  xiaomi: { name: "Xiaomi", website: "https://www.mi.com", country: "China" },
  "bytedance-seed": { name: "ByteDance Seed", website: "https://seed.bytedance.com", country: "China" },
  tencent: { name: "Tencent", website: "https://www.tencent.com", country: "China" },
  stepfun: { name: "StepFun", website: "https://www.stepfun.com", country: "China" },
  thinkingmachines: { name: "Thinking Machines Lab", website: "https://thinkingmachines.ai", country: "United States" },
  cohere: { name: "Cohere", website: "https://cohere.com", country: "Canada" },
  amazon: { name: "Amazon", website: "https://aws.amazon.com/ai", country: "United States" },
  inclusionai: { name: "inclusionAI", country: "China" },
  sakana: { name: "Sakana AI", website: "https://sakana.ai", country: "Japan" },
  perplexity: { name: "Perplexity", website: "https://www.perplexity.ai", country: "United States" },
  reflection: { name: "Reflection AI", website: "https://reflection.ai", country: "United States" },
  meituan: { name: "Meituan", website: "https://www.meituan.com", country: "China" },
  upstage: { name: "Upstage", website: "https://www.upstage.ai", country: "South Korea" },
  ibm: { name: "IBM", website: "https://www.ibm.com/granite", country: "United States" },
  microsoft: { name: "Microsoft", website: "https://www.microsoft.com/ai", country: "United States" },
  nousresearch: { name: "Nous Research", website: "https://nousresearch.com", country: "United States" },
  writer: { name: "Writer", website: "https://writer.com", country: "United States" },
  rekaai: { name: "Reka AI", website: "https://reka.ai", country: "United States" },
  baai: { name: "BAAI", website: "https://www.baai.ac.cn", country: "China" },
  voyageai: { name: "Voyage AI", website: "https://www.voyageai.com", country: "United States" },
  ai21: { name: "AI21 Labs", website: "https://www.ai21.com", country: "Israel" },
  liquid: { name: "Liquid AI", website: "https://www.liquid.ai", country: "United States" },
  "black-forest-labs": { name: "Black Forest Labs", website: "https://bfl.ai", country: "Germany" },
  elevenlabs: { name: "ElevenLabs", website: "https://elevenlabs.io" },
  allenai: { name: "Ai2", website: "https://allenai.org", country: "United States" },
  baidu: { name: "Baidu", website: "https://www.baidu.com", country: "China" },
  huawei: { name: "Huawei", website: "https://www.huawei.com", country: "China" },
  "arcee-ai": { name: "Arcee AI", website: "https://www.arcee.ai", country: "United States" },
  "aleph-alpha": { name: "Aleph Alpha", website: "https://aleph-alpha.com", country: "Germany" },
  sarvam: { name: "Sarvam AI", website: "https://www.sarvam.ai", country: "India" },
  "swiss-ai": { name: "Swiss AI Initiative", country: "Switzerland" },
  baichuan: { name: "Baichuan", country: "China" },
  openbmb: { name: "OpenBMB", country: "China" },
  mixedbread: { name: "Mixedbread", website: "https://www.mixedbread.com", country: "Germany" },
  inception: { name: "Inception Labs", website: "https://www.inceptionlabs.ai", country: "United States" },
  poolside: { name: "Poolside", website: "https://poolside.ai" },
};

export function titleize(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
