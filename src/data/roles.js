// Staff roles and the admin modules each may open (admin dashboard plan §3). The data layer enforces this map
// (mockApi `call`); route guards and the admin navigation only follow it. `modules: null` = every module.
export const STAFF = {
  super_admin: { label: 'Super admin', home: '/admin', modules: null },
  content_writer: { label: 'Content writer', home: '/admin/articles', modules: ['articles'] },
}

// `module` null asks for full access (operations only a super admin may run).
export const canOpen = (role, module = null) => {
  const s = STAFF[role]
  return !!s && (s.modules === null || (module !== null && s.modules.includes(module)))
}
