import type {
  ImageGenerationConfig,
  ImageGenerationOptions,
  ImageGenerationResult,
} from '../types';

const DEFAULT_MODEL = 'MiniMax-Image-01';
const DEFAULT_BASE_URL = 'https://api.minimax.chat/v1';

function resolveMinimaxSize(options: ImageGenerationOptions): string {
  const w = options.width || 1024;
  const h = options.height || 576;
  return `${w}*${h}`;
}

export async function testMinimaxImageConnectivity(
  config: ImageGenerationConfig,
): Promise<{ success: boolean; message: string }> {
  const colonIdx = (config.apiKey || '').indexOf(':');
  if (colonIdx <= 0) {
    return {
      success: false,
      message: 'Minimax Image requires API key in format "appId:apiKey"',
    };
  }
  const appId = config.apiKey!.slice(0, colonIdx);
  const apiKey = config.apiKey!.slice(colonIdx + 1);

  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  try {
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-App-Id': appId,
      },
      body: JSON.stringify({
        model: config.model || DEFAULT_MODEL,
        prompt: 'test',
        size: '1*1',
      }),
    });
    if (response.status === 401 || response.status === 403) {
      const text = await response.text();
      return {
        success: false,
        message: `Minimax Image auth failed (${response.status}): ${text}`,
      };
    }
    return { success: true, message: 'Connected to Minimax Image' };
  } catch (err) {
    return { success: false, message: `Minimax Image connectivity error: ${err}` };
  }
}

export async function generateWithMinimaxImage(
  config: ImageGenerationConfig,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  const colonIdx = (config.apiKey || '').indexOf(':');
  if (colonIdx <= 0) {
    throw new Error(
      'Minimax Image requires API key in format "appId:apiKey". Get both from the MiniMax console.',
    );
  }
  const appId = config.apiKey!.slice(0, colonIdx);
  const apiKey = config.apiKey!.slice(colonIdx + 1);

  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-App-Id': appId,
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_MODEL,
      prompt: options.prompt,
      negative_prompt: options.negativePrompt || undefined,
      size: resolveMinimaxSize(options),
      n: 1,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Minimax Image generation failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (data.code !== 0 || !data.data || !data.data.image_list || data.data.image_list.length === 0) {
    const errorMsg = data.message || 'Unknown error';
    throw new Error(`Minimax Image error: ${errorMsg} (code: ${data.code})`);
  }

  const imageItem = data.data.image_list[0];

  return {
    url: imageItem.image_url,
    width: options.width || 1024,
    height: options.height || 576,
  };
}
