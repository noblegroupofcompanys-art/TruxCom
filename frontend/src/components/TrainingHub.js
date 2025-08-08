import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  BookOpen, 
  Award, 
  Clock, 
  Star, 
  Users,
  PlayCircle,
  CheckCircle,
  Download,
  TrendingUp,
  Target,
  Eye,
  Play
} from 'lucide-react';
import axios from 'axios';

const TrainingHub = ({ user, token }) => {
  const [trainingData, setTrainingData] = useState({
    categories: [],
    courses: [],
    enrollments: [],
    certificates: []
  });
  
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadTrainingData();
  }, [token]);

  const loadTrainingData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, coursesRes, enrollmentsRes] = await Promise.allSettled([
        axios.get(`${BACKEND_URL}/api/training/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/training/courses`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/training/my-enrollments`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setTrainingData({
        categories: categoriesRes.status === 'fulfilled' ? categoriesRes.value.data : [],
        courses: coursesRes.status === 'fulfilled' ? coursesRes.value.data : [],
        enrollments: enrollmentsRes.status === 'fulfilled' ? enrollmentsRes.value.data : [],
        certificates: []
      });
    } catch (error) {
      console.error('Error loading training data:', error);
    } finally {
      setLoading(false);
    }
  };

  const enrollInCourse = async (courseId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/training/enroll/${courseId}`,
        { payment_method: 'trux_credit' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await loadTrainingData();
      alert('Successfully enrolled in course!');
    } catch (error) {
      console.error('Error enrolling in course:', error);
      alert('Error enrolling in course: ' + (error.response?.data?.detail || error.message));
    }
  };

  const updateProgress = async (enrollmentId, moduleId, contentItemId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/training/progress/${enrollmentId}`,
        {
          module_id: moduleId,
          content_item_id: contentItemId,
          completed: true,
          time_spent_minutes: 30,
          score: 85
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await loadTrainingData();
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const downloadCertificate = async (enrollmentId) => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/training/certificates/${enrollmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // In a real implementation, this would trigger a PDF download
      alert('Certificate downloaded! (Mock implementation)');
      console.log('Certificate data:', response.data);
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Certificate not available yet');
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'enrolled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDuration = (hours) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} mins`;
    }
    return `${hours}h`;
  };

  // Filter courses based on search and filters
  const filteredCourses = trainingData.courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || course.category_id === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || course.difficulty_level === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrolled Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trainingData.enrollments.length}</div>
            <p className="text-xs text-muted-foreground">
              {trainingData.enrollments.filter(e => e.status === 'completed').length} completed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificates Earned</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trainingData.enrollments.filter(e => e.certificate_issued).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                trainingData.enrollments.reduce((sum, e) => {
                  const course = trainingData.courses.find(c => c.id === e.course_id);
                  return sum + (course ? course.duration_hours * (e.progress_percentage / 100) : 0);
                }, 0)
              )}h
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Courses</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trainingData.courses.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="courses" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="courses">Course Catalog</TabsTrigger>
          <TabsTrigger value="my-courses">My Courses</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="progress">Learning Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {trainingData.categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Levels</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Course Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const isEnrolled = trainingData.enrollments.some(e => e.course_id === course.id);
              const category = trainingData.categories.find(c => c.id === course.category_id);
              
              return (
                <Card key={course.id} className="overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PlayCircle className="w-12 h-12 text-white opacity-80" />
                    </div>
                    <div className="absolute top-2 left-2">
                      <Badge className={getDifficultyColor(course.difficulty_level)}>
                        {course.difficulty_level}
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary">
                        {category?.name || 'General'}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold line-clamp-2">{course.title}</h4>
                      <p className="text-sm text-gray-600 line-clamp-2">{course.description}</p>
                      
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(course.duration_hours)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{course.total_enrollments}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span>{course.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-blue-600">
                          {course.price > 0 ? formatCurrency(course.price) : 'Free'}
                        </div>
                        <div className="text-sm text-gray-600">
                          by {course.instructor_name}
                        </div>
                      </div>
                      
                      {course.certification_provided && (
                        <Badge variant="outline" className="w-fit">
                          <Award className="w-3 h-3 mr-1" />
                          Certificate
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                  
                  <div className="px-4 pb-4">
                    {isEnrolled ? (
                      <Button variant="outline" className="w-full" disabled>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Enrolled
                      </Button>
                    ) : (
                      <Button 
                        className="w-full"
                        onClick={() => enrollInCourse(course.id)}
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        Enroll Now
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredCourses.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">No courses found matching your criteria</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="my-courses" className="space-y-4">
          <h3 className="text-lg font-semibold">My Enrolled Courses</h3>
          <div className="grid gap-4">
            {trainingData.enrollments.map((enrollment) => {
              const course = trainingData.courses.find(c => c.id === enrollment.course_id);
              if (!course) return null;
              
              return (
                <Card key={enrollment.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <BookOpen className="w-4 h-4 text-blue-500" />
                          <h4 className="font-semibold">{course.title}</h4>
                          <Badge className={getStatusColor(enrollment.status)}>
                            {enrollment.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">{course.description}</p>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{Math.round(enrollment.progress_percentage)}%</span>
                          </div>
                          <Progress value={enrollment.progress_percentage} className="w-full" />
                        </div>
                        
                        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
                          <span>Enrolled: {new Date(enrollment.enrollment_date).toLocaleDateString()}</span>
                          {enrollment.completion_date && (
                            <span>Completed: {new Date(enrollment.completion_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button size="sm" variant="outline">
                          <Play className="w-4 h-4 mr-1" />
                          Continue
                        </Button>
                        
                        {enrollment.certificate_issued && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => downloadCertificate(enrollment.id)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Certificate
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {trainingData.enrollments.length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-gray-500">No enrolled courses yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="certificates" className="space-y-4">
          <h3 className="text-lg font-semibold">My Certificates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trainingData.enrollments
              .filter(e => e.certificate_issued)
              .map((enrollment) => {
                const course = trainingData.courses.find(c => c.id === enrollment.course_id);
                if (!course) return null;
                
                return (
                  <Card key={enrollment.id} className="overflow-hidden">
                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white">
                      <div className="flex items-center justify-between">
                        <Award className="w-8 h-8" />
                        <Badge variant="secondary" className="text-orange-800">
                          Certificate
                        </Badge>
                      </div>
                      <h4 className="font-bold mt-2 text-lg">{course.title}</h4>
                      <p className="text-sm opacity-90">by {course.instructor_name}</p>
                    </div>
                    
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Completed:</span>
                          <span>{new Date(enrollment.completion_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Duration:</span>
                          <span>{formatDuration(course.duration_hours)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Score:</span>
                          <span>{enrollment.final_score || 'N/A'}%</span>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full mt-4"
                        onClick={() => downloadCertificate(enrollment.id)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Certificate
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
          
          {trainingData.enrollments.filter(e => e.certificate_issued).length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No certificates earned yet</p>
                  <p className="text-sm text-gray-400">Complete courses to earn certificates</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <h3 className="text-lg font-semibold">Learning Progress Overview</h3>
          
          {/* Progress Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Completion Rate</p>
                    <p className="text-2xl font-bold">
                      {trainingData.enrollments.length > 0 
                        ? Math.round((trainingData.enrollments.filter(e => e.status === 'completed').length / trainingData.enrollments.length) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Average Score</p>
                    <p className="text-2xl font-bold">
                      {trainingData.enrollments.filter(e => e.final_score).length > 0
                        ? Math.round(
                            trainingData.enrollments
                              .filter(e => e.final_score)
                              .reduce((sum, e) => sum + e.final_score, 0) /
                            trainingData.enrollments.filter(e => e.final_score).length
                          )
                        : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">Time Invested</p>
                    <p className="text-2xl font-bold">
                      {Math.round(
                        trainingData.enrollments.reduce((sum, e) => {
                          const course = trainingData.courses.find(c => c.id === e.course_id);
                          return sum + (course ? course.duration_hours * (e.progress_percentage / 100) : 0);
                        }, 0)
                      )}h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Progress */}
          <div className="space-y-4">
            <h4 className="font-medium">Course Progress Details</h4>
            {trainingData.enrollments.map((enrollment) => {
              const course = trainingData.courses.find(c => c.id === enrollment.course_id);
              if (!course) return null;
              
              return (
                <Card key={enrollment.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-medium">{course.title}</h5>
                        <p className="text-sm text-gray-600">{formatDuration(course.duration_hours)} • {course.instructor_name}</p>
                      </div>
                      <Badge className={getStatusColor(enrollment.status)}>
                        {enrollment.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{Math.round(enrollment.progress_percentage)}% Complete</span>
                      </div>
                      <Progress value={enrollment.progress_percentage} className="w-full" />
                      
                      {enrollment.final_score && (
                        <div className="flex justify-between text-sm">
                          <span>Final Score</span>
                          <span className="font-medium">{enrollment.final_score}%</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrainingHub;