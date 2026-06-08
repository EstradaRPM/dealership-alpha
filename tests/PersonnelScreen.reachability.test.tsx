import * as fs from 'fs';
import * as path from 'path';

describe('#204 multi-role hiring reachability', () => {
  it('keeps multi-role hiring wired through the live App personnel route', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');

    expect(src).toMatch(/buildHiringRoleOptions\(world\.tierManager\.currentTier\)/);
    expect(src).toMatch(/roleOptions=\{roleOptions\}/);
    expect(src).toMatch(/selectedRoleId=\{selectedRoleId\}/);
    expect(src).toMatch(/world\.staffOrg\.getCandidates\(selectedRoleId\)/);
    expect(src).toMatch(/onSelectRole=\{setSelectedHiringRoleId\}/);
    expect(src).toMatch(/world\.staffOrg\.fire\(staffId\)/);
  });
});
