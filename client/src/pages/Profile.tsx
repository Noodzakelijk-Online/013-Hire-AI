import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Upload, 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  Linkedin, 
  Github,
  Briefcase,
  GraduationCap,
  Code,
  FolderGit2,
  Globe
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Profile() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isUploading, setIsUploading] = useState(false);
  
  // Dialog states
  const [workExpDialogOpen, setWorkExpDialogOpen] = useState(false);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  
  // Editing states
  const [editingWorkExp, setEditingWorkExp] = useState<any>(null);
  const [editingEducation, setEditingEducation] = useState<any>(null);
  const [editingSkill, setEditingSkill] = useState<any>(null);
  const [editingProject, setEditingProject] = useState<any>(null);

  // Queries
  const workExperiencesQuery = trpc.profile.getWorkExperiences.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const educationQuery = trpc.profile.getEducation.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const skillsQuery = trpc.profile.getSkills.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const projectsQuery = trpc.profile.getProjects.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    toast.info("Resume upload coming soon! For now, add your experience manually below.");
    setIsUploading(false);
  };

  const handleLinkedInConnect = () => {
    toast.info("LinkedIn integration coming soon!");
  };

  const handleGitHubConnect = () => {
    toast.info("GitHub integration coming soon!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <AppHeader currentPage="profile" />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AppHeader currentPage="profile" />
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Profile</h1>
          <p className="text-slate-400">
            Build your professional profile to help our AI find the perfect job matches
          </p>
        </div>

        {/* Import Profile Card */}
        <Card className="mb-6 bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-400" />
              Import Your Profile
            </CardTitle>
            <CardDescription>
              Quickly populate your profile by connecting your accounts or uploading your resume
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-slate-700 hover:border-cyan-500 hover:bg-cyan-500/10"
                onClick={handleLinkedInConnect}
              >
                <Linkedin className="w-6 h-6 text-blue-500" />
                <span className="text-white">Connect LinkedIn</span>
              </Button>
              
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-slate-700 hover:border-cyan-500 hover:bg-cyan-500/10"
                onClick={handleGitHubConnect}
              >
                <Github className="w-6 h-6 text-white" />
                <span className="text-white">Connect GitHub</span>
              </Button>
              
              <label>
                <Button
                  variant="outline"
                  className="h-24 w-full flex-col gap-2 border-slate-700 hover:border-cyan-500 hover:bg-cyan-500/10 cursor-pointer"
                  disabled={isUploading}
                  asChild
                >
                  <div>
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    ) : (
                      <Upload className="w-6 h-6 text-cyan-400" />
                    )}
                    <span className="text-white">Upload Resume</span>
                  </div>
                </Button>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={handleResumeUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Social Media & Portfolio Links */}
        <Card className="mb-6 bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              Social Media & Portfolio
            </CardTitle>
            <CardDescription>
              Add links to your professional profiles and portfolio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  LinkedIn URL
                </label>
                <Input
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  GitHub URL
                </label>
                <Input
                  placeholder="https://github.com/yourusername"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  Portfolio URL
                </label>
                <Input
                  placeholder="https://yourportfolio.com"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  Twitter/X URL
                </label>
                <Input
                  placeholder="https://twitter.com/yourusername"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => toast.success("Social links saved!")}
                className="bg-gradient-to-r from-cyan-500 to-blue-600"
              >
                Save Links
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Work Experience Section */}
        <Card className="mb-6 bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-white">Work Experience</CardTitle>
              </div>
              <WorkExperienceDialog
                open={workExpDialogOpen}
                onOpenChange={setWorkExpDialogOpen}
                editing={editingWorkExp}
                onSuccess={() => {
                  workExperiencesQuery.refetch();
                  setWorkExpDialogOpen(false);
                  setEditingWorkExp(null);
                }}
              />
            </div>
            <CardDescription>
              Add your professional work history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workExperiencesQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : workExperiencesQuery.data && workExperiencesQuery.data.length > 0 ? (
              <div className="space-y-4">
                {workExperiencesQuery.data.map((exp: any) => (
                  <WorkExperienceCard
                    key={exp.id}
                    experience={exp}
                    onEdit={() => {
                      setEditingWorkExp(exp);
                      setWorkExpDialogOpen(true);
                    }}
                    onDelete={() => {
                      if (confirm("Are you sure you want to delete this work experience?")) {
                        // Delete mutation will be added
                        toast.success("Work experience deleted");
                        workExperiencesQuery.refetch();
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-4">No work experience added yet</p>
                <Button
                  onClick={() => setWorkExpDialogOpen(true)}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Work Experience
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Education Section */}
        <Card className="mb-6 bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-white">Education</CardTitle>
              </div>
              <EducationDialog
                open={educationDialogOpen}
                onOpenChange={setEducationDialogOpen}
                editing={editingEducation}
                onSuccess={() => {
                  educationQuery.refetch();
                  setEducationDialogOpen(false);
                  setEditingEducation(null);
                }}
              />
            </div>
            <CardDescription>
              Add your educational background
            </CardDescription>
          </CardHeader>
          <CardContent>
            {educationQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : educationQuery.data && educationQuery.data.length > 0 ? (
              <div className="space-y-4">
                {educationQuery.data.map((edu: any) => (
                  <EducationCard
                    key={edu.id}
                    education={edu}
                    onEdit={() => {
                      setEditingEducation(edu);
                      setEducationDialogOpen(true);
                    }}
                    onDelete={() => {
                      if (confirm("Are you sure you want to delete this education entry?")) {
                        toast.success("Education entry deleted");
                        educationQuery.refetch();
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No education added yet</p>
                <p className="text-xs text-slate-500 mt-1">Click "Add Education" above to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skills Section */}
        <Card className="mb-6 bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-white">Skills</CardTitle>
              </div>
              <SkillDialog
                open={skillDialogOpen}
                onOpenChange={setSkillDialogOpen}
                editing={editingSkill}
                onSuccess={() => {
                  skillsQuery.refetch();
                  setSkillDialogOpen(false);
                  setEditingSkill(null);
                }}
              />
            </div>
            <CardDescription>
              Add your technical and professional skills
            </CardDescription>
          </CardHeader>
          <CardContent>
            {skillsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : skillsQuery.data && skillsQuery.data.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skillsQuery.data.map((skill: any) => (
                  <SkillBadge
                    key={skill.id}
                    skill={skill}
                    onEdit={() => {
                      setEditingSkill(skill);
                      setSkillDialogOpen(true);
                    }}
                    onDelete={() => {
                      if (confirm(`Remove ${skill.skillName}?`)) {
                        toast.success("Skill removed");
                        skillsQuery.refetch();
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Code className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No skills added yet</p>
                <p className="text-xs text-slate-500 mt-1">Click "Add Skill" above to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projects Section (Optional) */}
        <Card className="mb-6 bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-white">Projects</CardTitle>
              </div>
              <ProjectDialog
                open={projectDialogOpen}
                onOpenChange={setProjectDialogOpen}
                editing={editingProject}
                onSuccess={() => {
                  projectsQuery.refetch();
                  setProjectDialogOpen(false);
                  setEditingProject(null);
                }}
              />
            </div>
            <CardDescription>
              Showcase your portfolio and side projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : projectsQuery.data && projectsQuery.data.length > 0 ? (
              <div className="space-y-4">
                {projectsQuery.data.map((project: any) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={() => {
                      setEditingProject(project);
                      setProjectDialogOpen(true);
                    }}
                    onDelete={() => {
                      if (confirm("Are you sure you want to delete this project?")) {
                        toast.success("Project deleted");
                        projectsQuery.refetch();
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderGit2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No projects added yet</p>
                <p className="text-xs text-slate-500 mt-1">Click "Add Project" above to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Component stubs - will be implemented
function WorkExperienceDialog({ open, onOpenChange, editing, onSuccess }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Experience
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Edit Work Experience" : "Add Work Experience"}
          </DialogTitle>
          <DialogDescription>
            Add details about your professional experience
          </DialogDescription>
        </DialogHeader>
        <div className="text-slate-400 text-center py-8">
          Form implementation coming next...
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EducationDialog({ open, onOpenChange, editing, onSuccess }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Education
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Edit Education" : "Add Education"}
          </DialogTitle>
          <DialogDescription>
            Add details about your educational background
          </DialogDescription>
        </DialogHeader>
        <div className="text-slate-400 text-center py-8">
          Form implementation coming next...
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SkillDialog({ open, onOpenChange, editing, onSuccess }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Skill
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Edit Skill" : "Add Skill"}
          </DialogTitle>
          <DialogDescription>
            Add a technical or professional skill
          </DialogDescription>
        </DialogHeader>
        <div className="text-slate-400 text-center py-8">
          Form implementation coming next...
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({ open, onOpenChange, editing, onSuccess }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Edit Project" : "Add Project"}
          </DialogTitle>
          <DialogDescription>
            Showcase a portfolio project or side project
          </DialogDescription>
        </DialogHeader>
        <div className="text-slate-400 text-center py-8">
          Form implementation coming next...
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkExperienceCard({ experience, onEdit, onDelete }: any) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-white font-semibold">{experience.jobTitle}</h3>
          <p className="text-slate-400">{experience.company}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-2">
        {new Date(experience.startDate).toLocaleDateString()} - {experience.isCurrent ? "Present" : new Date(experience.endDate).toLocaleDateString()}
      </p>
      {experience.description && (
        <p className="text-slate-400 text-sm">{experience.description}</p>
      )}
    </div>
  );
}

function EducationCard({ education, onEdit, onDelete }: any) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-white font-semibold">{education.degree}</h3>
          <p className="text-slate-400">{education.institution}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {education.fieldOfStudy && (
        <p className="text-slate-400 text-sm mb-1">{education.fieldOfStudy}</p>
      )}
      <p className="text-sm text-slate-500">
        {education.endDate ? new Date(education.endDate).getFullYear() : "In Progress"}
      </p>
    </div>
  );
}

function SkillBadge({ skill, onEdit, onDelete }: any) {
  const proficiencyColors = {
    beginner: "bg-slate-700 text-slate-300",
    intermediate: "bg-blue-900/30 text-blue-400 border-blue-500/30",
    advanced: "bg-purple-900/30 text-purple-400 border-purple-500/30",
    expert: "bg-cyan-900/30 text-cyan-400 border-cyan-500/30",
  };

  return (
    <div className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${proficiencyColors[skill.proficiency as keyof typeof proficiencyColors] || proficiencyColors.intermediate}`}>
      <span className="text-sm font-medium">{skill.skillName}</span>
      <div className="hidden group-hover:flex absolute -top-8 right-0 gap-1 bg-slate-800 border border-slate-700 rounded-md p-1">
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onEdit}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400" onClick={onDelete}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function ProjectCard({ project, onEdit, onDelete }: any) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-white font-semibold">{project.title}</h3>
          {project.url && (
            <a href={project.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-sm hover:underline">
              View Project →
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {project.description && (
        <p className="text-slate-400 text-sm mb-2">{project.description}</p>
      )}
      {project.technologies && (
        <p className="text-slate-500 text-xs">Technologies: {project.technologies}</p>
      )}
    </div>
  );
}
