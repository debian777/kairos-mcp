Files here are linted with the same backend rules as src/ elsewhere, but
linterOptions.noInlineConfig is false so eslint-disable-next-line can target
rules that otherwise conflict with third-party API spellings (see eslint/flat-config.cjs).

Keep this directory minimal; do not use it to bypass repo-wide lint policy.
