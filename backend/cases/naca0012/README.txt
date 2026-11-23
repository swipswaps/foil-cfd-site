Bundled 2D channel placeholder for simpleFoam.

This directory is named naca0012 for API compatibility, but the mesh in
system/blockMeshDict is a rectangular channel, not an airfoil. It exists so
the OpenFOAM image can run a real (fast) solve end to end: blockMesh,
simpleFoam, field output, VTP surface export.

For a real NACA 0012 RANS case, replace blockMeshDict with a snappyHexMesh
workflow and a NACA0012 STL, then update 0/ and constant/ wall patches.
