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
    groundingHeading: '## Project Grounding (auto-scanned)',
    groundingRoot: 'Root',
    groundingBranch: 'Git branch',
    groundingStructure: 'Structure (trimmed)',
    groundingCommands: 'Detected verify commands',
    groundingNone: '(none detected — ask the user how to verify changes)',
    loopHeading: '## Execution Loop (mandatory)',
    loopPlan: '1. **PLAN** — state your approach and the files you will touch before editing anything.',
    loopAct: '2. **ACT** — make the smallest coherent change that advances the plan.',
    loopVerify: (cmds) => `3. **VERIFY** — run the project's checks and read the output: ${cmds}.`,
    loopVerifyGeneric: '3. **VERIFY** — run the project\'s tests/linters and read the output; if none exist, ask the user how to verify.',
    loopSelfVerify: '3. **SELF-VERIFY** — you have no terminal access: re-read your output against the requirements and fix gaps before finalizing.',
    loopIterate: '4. **ITERATE** — if verification fails, diagnose and fix (max 5 loops); never declare success while checks are failing.',
    loopReport: '5. **REPORT** — summarize what changed and cite verification evidence (commands run, results observed).',
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
    groundingHeading: '## Contexto del proyecto (escaneo automático)',
    groundingRoot: 'Raíz',
    groundingBranch: 'Rama Git',
    groundingStructure: 'Estructura (recortada)',
    groundingCommands: 'Comandos de verificación detectados',
    groundingNone: '(ninguno detectado — pregunta al usuario cómo verificar los cambios)',
    loopHeading: '## Bucle de ejecución (obligatorio)',
    loopPlan: '1. **PLANIFICA** — indica tu enfoque y los archivos que modificarás antes de editar nada.',
    loopAct: '2. **ACTÚA** — realiza el cambio coherente más pequeño que avance el plan.',
    loopVerify: (cmds) => `3. **VERIFICA** — ejecuta las comprobaciones del proyecto y lee el resultado: ${cmds}.`,
    loopVerifyGeneric: '3. **VERIFICA** — ejecuta los tests/linters del proyecto y lee el resultado; si no existen, pregunta al usuario cómo verificar.',
    loopSelfVerify: '3. **AUTOVERIFICA** — no tienes terminal: relee tu salida contra los requisitos y corrige las carencias antes de finalizar.',
    loopIterate: '4. **ITERA** — si la verificación falla, diagnostica y corrige (máx. 5 ciclos); nunca declares éxito con comprobaciones fallidas.',
    loopReport: '5. **INFORMA** — resume los cambios y cita la evidencia de verificación (comandos ejecutados, resultados observados).',
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
    groundingHeading: '## プロジェクト情報（自動スキャン）',
    groundingRoot: 'ルート',
    groundingBranch: 'Git ブランチ',
    groundingStructure: '構造（抜粋）',
    groundingCommands: '検出された検証コマンド',
    groundingNone: '（検出なし — 変更の確認方法をユーザーに尋ねてください）',
    loopHeading: '## 実行ループ（必須）',
    loopPlan: '1. **PLAN** — 編集前に方針と変更対象ファイルを明示する。',
    loopAct: '2. **ACT** — 計画を進める最小の一貫した変更を行う。',
    loopVerify: (cmds) => `3. **VERIFY** — プロジェクトのチェックを実行し、出力を確認する: ${cmds}。`,
    loopVerifyGeneric: '3. **VERIFY** — プロジェクトのテスト/リンターを実行して出力を確認する。存在しない場合は確認方法をユーザーに尋ねる。',
    loopSelfVerify: '3. **SELF-VERIFY** — ターミナルがないため、出力を要件と照合し、不足を修正してから確定する。',
    loopIterate: '4. **ITERATE** — 検証が失敗したら診断して修正する（最大5回）。チェックが失敗したまま成功と宣言しない。',
    loopReport: '5. **REPORT** — 変更内容を要約し、検証の根拠（実行コマンドと結果）を示す。',
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
    groundingHeading: '## 项目背景（自动扫描）',
    groundingRoot: '根目录',
    groundingBranch: 'Git 分支',
    groundingStructure: '目录结构（节选）',
    groundingCommands: '检测到的验证命令',
    groundingNone: '（未检测到 — 请询问用户如何验证更改）',
    loopHeading: '## 执行循环（强制）',
    loopPlan: '1. **PLAN** — 在编辑任何内容之前，说明你的方案和将修改的文件。',
    loopAct: '2. **ACT** — 做出推进计划的最小连贯更改。',
    loopVerify: (cmds) => `3. **VERIFY** — 运行项目的检查并查看输出：${cmds}。`,
    loopVerifyGeneric: '3. **VERIFY** — 运行项目的测试/代码检查并查看输出；如不存在，请询问用户如何验证。',
    loopSelfVerify: '3. **SELF-VERIFY** — 你没有终端权限：根据需求复查输出，修正缺漏后再定稿。',
    loopIterate: '4. **ITERATE** — 若验证失败，诊断并修复（最多 5 次循环）；检查未通过时不得宣称成功。',
    loopReport: '5. **REPORT** — 总结所做更改，并引用验证证据（运行的命令及观察到的结果）。',
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
