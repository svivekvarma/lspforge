Add Neovim Native LSP Support

lspforge needs to be able to detect and configure Neovim's built-in LSP (added in Neovim 0.11+).

This issue is to track the implementation of:
- A new client module (`src/clients/neovim.ts`) that writes configuration to `~/.config/nvim/plugin/lspforge/`.
- Detection logic to automatically identify and configure `nvim`.
- Unit tests verifying Neovim configuration workflows.
- Updating `README.md` to indicate Neovim support.
