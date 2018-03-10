Laser cut layout builder.

Plane - sheet of material with certain set of holes cut to host switches
        stabilisers and wiring
Subplane - subplane is used when you need to split your design in multiple sheets
Size  - keycap size name (in 19.05 units usually except for special keys)
        e.g. 1.0u, 1.5u, Enter

Script will generate planes for keyboard layouts.
Generation is based on Layer and Block naming conventions.
Block naming: Key_<size>_<plane>
Plane naming: <plane> or <plane>_<subplane>

Generator scans drawing for block refs with Layout plane in name.
For each found block it finds blocks with the same size but different plane
and inserts them in corresponding position of those planes.

To use, create layers with names matching plane names in block names if you
want plane to be generated.

If you want to split layout into several parts, use subplanes in layout:
Layout_Left, Layout_Right etc and create other planes with corresponding names
Base_Left, Base_Right to produce partial layers.
