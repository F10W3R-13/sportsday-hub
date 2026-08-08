export const queryKeys = {
  teams: ['teams'] as const,
  team: (id: string) => ['teams', id] as const,
  decisions: ['decisions'] as const,
  milestones: ['milestones'] as const,
  milestonesByTeam: (teamId: string) => ['milestones', 'team', teamId] as const,
  checklist: ['checklist'] as const,
  checklistByTeam: (teamId: string) => ['checklist', 'team', teamId] as const,
  issues: ['issues'] as const,
  issuesByTeam: (teamId: string) => ['issues', 'team', teamId] as const,
}
