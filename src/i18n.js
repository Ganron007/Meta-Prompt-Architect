const SUPPORTED_LANGS = ['en', 'es', 'ja', 'zh'];

const STRINGS = {
  en: {
    roleLine: (title, label) => `Role: ${title} specializing in ${label}`,
    contextHeading: '## Context & Constraints',
    inputsHeading: '## Inputs',
    objectiveHeading: '## Objective',
    outputHeading: '## Output Format',
    examplesHeading: '## Examples',
    initHeading: '## Initialization',
    initBody: 'Introduce yourself, confirm your role, and ask for any missing inputs before proceeding. Be concise.',
    taskLabel: 'Task',
    contextLabel: 'Additional Context',
    dataLabel: 'Data/Files',
    insertData: '[INSERT RELEVANT CONTENT HERE]',
    insertTask: '[INSERT TASK HERE]',
    toneLabel: 'Tone',
    constraintsLabel: 'Constraints',
    objectiveSteps: (task, outputFormat) => [
      `1. Understand the user's core need: ${task}`,
      '2. Break the task into concrete, actionable steps.',
      `3. Produce a high-quality response in the requested format (${outputFormat}).`
    ],
    objectiveExamples: '4. Include relevant examples when helpful.',
    outputSpecs: {
      markdown: 'Use Markdown with clear headings, bullet points, and code blocks where relevant.',
      json: 'Return a JSON object with the requested fields. No markdown, no explanatory text.',
      table: 'Present findings in a Markdown table with clear column headers.',
      code: 'Provide code in a clean, well-commented block. Include usage examples.',
      diagram: 'Provide a text-based diagram (Mermaid, ASCII, or bulleted list) plus explanation.',
      text: 'Return plain text with numbered steps or paragraphs. No special formatting required.'
    }
  },

  es: {
    roleLine: (title, label) => `Rol: ${title} especializado en ${label}`,
    contextHeading: '## Contexto y restricciones',
    inputsHeading: '## Entradas',
    objectiveHeading: '## Objetivo',
    outputHeading: '## Formato de salida',
    examplesHeading: '## Ejemplos',
    initHeading: '## Inicialización',
    initBody: 'Preséntate, confirma tu rol y solicita cualquier entrada que falte antes de continuar. Sé conciso.',
    taskLabel: 'Tarea',
    contextLabel: 'Contexto adicional',
    dataLabel: 'Datos/Archivos',
    insertData: '[INSERTA EL CONTENIDO RELEVANTE AQUÍ]',
    insertTask: '[INSERTA LA TAREA AQUÍ]',
    toneLabel: 'Tono',
    constraintsLabel: 'Restricciones',
    objectiveSteps: (task, outputFormat) => [
      `1. Comprende la necesidad principal del usuario: ${task}`,
      '2. Divide la tarea en pasos concretos y accionables.',
      `3. Produce una respuesta de alta calidad en el formato solicitado (${outputFormat}).`
    ],
    objectiveExamples: '4. Incluye ejemplos relevantes cuando sea útil.',
    outputSpecs: {
      markdown: 'Usa Markdown con encabezados claros, viñetas y bloques de código cuando corresponda.',
      json: 'Devuelve un objeto JSON con los campos solicitados. Sin markdown, sin texto explicativo.',
      table: 'Presenta los resultados en una tabla Markdown con encabezados de columna claros.',
      code: 'Proporciona el código en un bloque limpio y bien comentado. Incluye ejemplos de uso.',
      diagram: 'Proporciona un diagrama de texto (Mermaid, ASCII o lista con viñetas) más una explicación.',
      text: 'Devuelve texto plano con pasos numerados o párrafos. Sin formato especial.'
    }
  },

  ja: {
    roleLine: (title, label) => `ロール: ${label}の専門家である${title}`,
    contextHeading: '## コンテキストと制約',
    inputsHeading: '## 入力',
    objectiveHeading: '## 目的',
    outputHeading: '## 出力形式',
    examplesHeading: '## 例',
    initHeading: '## 初期化',
    initBody: '自己紹介を行い、ロールを確認し、不足している入力があれば尋ねてから進んでください。簡潔に。',
    taskLabel: 'タスク',
    contextLabel: '追加コンテキスト',
    dataLabel: 'データ/ファイル',
    insertData: '[ここに関連コンテンツを挿入]',
    insertTask: '[ここにタスクを挿入]',
    toneLabel: 'トーン',
    constraintsLabel: '制約',
    objectiveSteps: (task, outputFormat) => [
      `1. ユーザーの核心的なニーズを理解する: ${task}`,
      '2. タスクを具体的で実行可能なステップに分解する。',
      `3. 要求された形式（${outputFormat}）で高品質な回答を作成する。`
    ],
    objectiveExamples: '4. 有用な場合は関連する例を含める。',
    outputSpecs: {
      markdown: '明確な見出し、箇条書き、必要に応じてコードブロックを使い、Markdownで記述する。',
      json: '要求されたフィールドを持つJSONオブジェクトを返す。Markdownや説明文は含めない。',
      table: '明確な列見出しを持つMarkdown表で結果を提示する。',
      code: 'クリーンで適切にコメントされたブロックでコードを提供する。使用例を含める。',
      diagram: 'テキストベースの図（Mermaid、ASCII、または箇条書き）と説明を提供する。',
      text: '番号付きステップまたは段落のプレーンテキストを返す。特別な書式は不要。'
    }
  },

  zh: {
    roleLine: (title, label) => `角色：${title}，专注于${label}`,
    contextHeading: '## 背景与约束',
    inputsHeading: '## 输入',
    objectiveHeading: '## 目标',
    outputHeading: '## 输出格式',
    examplesHeading: '## 示例',
    initHeading: '## 初始化',
    initBody: '介绍你自己，确认你的角色，并在继续之前询问任何缺失的输入。保持简洁。',
    taskLabel: '任务',
    contextLabel: '补充背景',
    dataLabel: '数据/文件',
    insertData: '[在此插入相关内容]',
    insertTask: '[在此插入任务]',
    toneLabel: '语气',
    constraintsLabel: '约束',
    objectiveSteps: (task, outputFormat) => [
      `1. 理解用户的核心需求：${task}`,
      '2. 将任务分解为具体、可执行的步骤。',
      `3. 以请求的格式（${outputFormat}）产出高质量的回复。`
    ],
    objectiveExamples: '4. 在有帮助时包含相关示例。',
    outputSpecs: {
      markdown: '使用 Markdown，包含清晰的标题、要点列表，并在相关处使用代码块。',
      json: '返回包含请求字段的 JSON 对象。不要 Markdown，不要解释性文字。',
      table: '用带有清晰列标题的 Markdown 表格呈现结果。',
      code: '在干净、注释完善的代码块中提供代码。包含使用示例。',
      diagram: '提供基于文本的图表（Mermaid、ASCII 或要点列表）并附说明。',
      text: '返回带有编号步骤或段落的纯文本。无需特殊格式。'
    }
  }
};

function resolveLang(lang) {
  const code = String(lang || 'en').toLowerCase().split('-')[0];
  return SUPPORTED_LANGS.includes(code) ? code : 'en';
}

function getStrings(lang) {
  return STRINGS[resolveLang(lang)];
}

module.exports = { SUPPORTED_LANGS, STRINGS, resolveLang, getStrings };
