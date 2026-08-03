function buildGistPayload(pack, { description, public: isPublic = false } = {}) {
  const filename = `${String(pack.name).replace(/[^a-zA-Z0-9._-]/g, '_')}.json`;
  return {
    description: description || `Meta-Prompt Architect recipe pack: ${pack.name}`,
    public: !!isPublic,
    files: {
      [filename]: { content: `${JSON.stringify(pack, null, 2)}\n` }
    }
  };
}

async function publishPackToGist(pack, { token, description, public: isPublic } = {}) {
  const auth = token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!auth) throw new Error('Gist sharing needs a GitHub token (set GITHUB_TOKEN or GH_TOKEN).');
  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth}`,
      'Content-Type': 'application/json',
      'User-Agent': 'meta-prompt-architect'
    },
    body: JSON.stringify(buildGistPayload(pack, { description, public: isPublic })),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return { url: data.html_url, id: data.id, filename: Object.keys(data.files)[0] };
}

module.exports = { buildGistPayload, publishPackToGist };
