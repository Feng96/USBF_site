# USBF local engine settings design

Open the [interactive preview](https://feng96.github.io/USBF_site/prototypes/local-engine/).
This route is a standalone interaction prototype. Every device reading, task,
connection, installation, compatibility check and uninstall is simulated. Beyond loading its own static page assets, it makes no service requests and
accesses no local files, loopback services, installed packages or browser storage. It does not ship an installer or enable native processing in
the production map. Reloading resets all simulated state.

The UI remains English by default, with a Chinese interface option. Data names,
format names, dependency names and example paths are not translated.

## Product decisions

The default is a **USBF-managed runtime**, shipped with the companion app and
pinned as a tested unit. Existing GDAL, PROJ, GEOS, DuckDB, Python, Conda and QGIS
installations are not dependencies of the everyday installation experience.
A user should not need a terminal or a package manager. A separate application
folder alone is not sufficient isolation: the engine must resolve its own native
libraries, coordinate resources and DuckDB extensions without importing packages
or configuration from an unrelated GIS installation.

A complete custom environment is an advanced opt-in. Detection is informative;
it never selects packages automatically. The user selects one complete runtime,
checks it, and explicitly applies it to future jobs. Do not mix individual
libraries from several environments inside the desktop manager's process. The
worker process records the actual runtime and component versions used by each
job. Changing the default must not change a running job.

Binary compatibility and availability are capability concerns, not just version
comparisons. A custom-runtime check should verify executable architecture,
required GDAL drivers, the DuckDB spatial extension, coordinate resource
availability, controlled CRS transformations, and representative read/process/
write operations. Incompatibility keeps the managed runtime selected; it never
triggers package installation, upgrades or repairs inside the user's environment.

## Make three locations explicit

| UI item | Meaning | Example |
|---|---|---|
| Input data | Where original data is read | Source Cooperative into local cache |
| Computation | Where the operation runs | Browser tab, local native app, or configured remote worker |
| Results | Where full results persist | User-selected local folder |

Browser and native-app execution both use the user's computer. Cloud input data
is not cloud computation. The cloud execution option stays unavailable until an
actual processing service exists and has been explicitly connected.

A large requested selection stays large: the interface must not silently replace
it with a truncated browser sample. The companion app would accept the saved
study area, dataset publication and selection predicate/IDs as a job definition.
Full originals and output remain on disk; the website receives tiled display,
paged attributes and statistics. The existing fixed-area/input contract remains
the source of truth for which buildings a task processes.

## Connection and installation

An unreachable endpoint is **Not connected**, not proof that an app is absent.
The UI offers both setup and connection to an already installed app. Initial
connection must follow a user click, browser permission where applicable, and
pairing with the companion. It must not scan the device or private network on
page load. Installation and uninstallation use native OS confirmation.

A real release needs per-platform build artifacts and verification. Candidate
packaging is a Tauri manager with an isolated native engine; Windows installers,
macOS application installers and Linux packages are separate release targets.
The prototype's platform selector is not hardware detection and provides no
binary download. A production installer selector should let users confirm the OS
and architecture rather than guessing silently.

## Management controls

- Overview: three execution modes, input/compute/result flow and a task's input
  scope. The native mode never pretends to be connected before pairing.
- Local engine: connection state, app/device/runtime information, resource
  profiles, explicit sign-in startup, signed updates, repair, stop/start and
  uninstall.
- Storage: separate managed program files, re-downloadable cache, job state/logs
  and user projects/results. Example paths follow each platform's conventions.
- Advanced: managed/custom environment choice, requested inspection, a per-feature
  compatibility report, and an explicit apply button after checks pass.
- Activity: the execution location, requested record count and runtime captured
  for each simulated job.

Real device information should come from the paired native app, not fabricated
browser estimates: app version, OS/architecture, CPU capacity, RAM, configured
resource budgets, disk/cache usage, active jobs and selected runtime. Normal
settings can show a simple health summary; dependency builds and diagnostics
belong in expandable details.

## Update, repair and uninstall boundaries

Managed releases are versioned and verified as a unit, including native
libraries, coordinate resources and matching spatial extensions. The updater
verifies signatures and compatibility, waits for active jobs, then selects the
new runtime for new jobs. A failed startup can roll back to the last working
runtime. Repair only affects the managed runtime.

The native uninstaller removes the application and its managed environment.
Cached input can be removed independently. Projects, full results and external
software are preserved by default. Deleting user outputs is a separate deliberate
operation, not a side effect of uninstall. Active jobs must finish or be explicitly
cancelled before removing the runtime they use.

The preview demonstrates safe state transitions, including blocking uninstall
while a job runs, preserving requested counts, rejecting an incompatible
external runtime, and retaining user results after cache/app removal. It does
not run those actions on the computer.

## Sources and validation

- [Tauri distribution and platform installers](https://v2.tauri.app/distribute/)
- [Tauri signed updater](https://v2.tauri.app/plugin/updater/)
- [DuckDB extension binary compatibility](https://duckdb.org/docs/2.0/extensions/extension_distribution)
- [GDAL dependencies and conflicting PROJ libraries](https://gdal.org/en/stable/development/building_from_source.html)
- [Chrome local connection permissions](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access)

`tools/engine-design-checks.cjs` exercises the standalone browser prototype,
including Chinese/mobile layout. Native installers, local API permissions,
package signatures, real performance and uninstall behavior require validation
when an actual companion app is implemented; they are not verified by this
prototype.
