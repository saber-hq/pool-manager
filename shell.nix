{ pkgs, ci }:
pkgs.stdenvNoCC.mkDerivation {
  name = "devshell";
  buildInputs = with pkgs;
    (pkgs.lib.optionals pkgs.stdenv.isLinux ([
      udev
    ])) ++ [ ci cargo-deps gh spl-token-cli nixpkgs-fmt ]
    ++ (pkgs.lib.optionals pkgs.stdenv.isDarwin [
      pkgs.darwin.apple_sdk.frameworks.AppKit
      pkgs.darwin.apple_sdk.frameworks.IOKit
      pkgs.darwin.apple_sdk.frameworks.Foundation
    ]);
}
