{
  description = "RT Connect Google Chat integration";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      lib = pkgs.lib;
      source = lib.cleanSourceWith {
        src = ./.;
        filter = path: type:
          let
            relative = lib.removePrefix "${toString ./.}/" (toString path);
            name = baseNameOf path;
          in
            name != ".git"
            && name != "node_modules"
            && name != "dist"
            && name != "build"
            && name != ".aistudio"
            && !(lib.hasPrefix ".env" name)
            && relative != "data/store.json";
      };
      package = pkgs.buildNpmPackage {
        pname = "request-tracker-google-chat-integration";
        version = "0.1.0";
        src = source;
        npmDepsHash = "sha256-pUd8LufmA+aggtn+GO+chuu+ejzPUDipgEz/HfyEt6M=";
        npmFlags = [ "--legacy-peer-deps" ];
        nativeBuildInputs = [ pkgs.makeWrapper ];
        npmBuildScript = "build";
        installPhase = ''
          runHook preInstall
          runtimeRoot="$out/lib/request-tracker-google-chat-integration"
          mkdir -p "$runtimeRoot" "$out/bin"
          cp -r dist server.ts src package.json "$runtimeRoot/"
          cp -r node_modules "$runtimeRoot/"
          makeWrapper ${pkgs.nodejs}/bin/node "$out/bin/request-tracker-google-chat-integration" \
            --add-flags "$runtimeRoot/node_modules/tsx/dist/cli.mjs" \
            --add-flags "$runtimeRoot/server.ts"
          runHook postInstall
        '';
      };
    in
    {
      packages.${system}.default = package;
      nixosModules.default = import ./nix/module.nix { inherit self; };
      checks.${system}.default = package;
    };
}
