import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, MapPin, Calendar, Clock, User, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CreateJobModalProps {
  onClose: () => void;
}

export default function CreateJobModal({ onClose }: CreateJobModalProps) {
  const [step, setStep] = useState(1);
  const [jobData, setJobData] = useState({
    address: "",
    customerId: "",
    appointmentDate: "",
    appointmentTime: "",
    dueDate: "",
    totalValue: "",
    notes: "",
    status: "scheduled"
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: customers = [] } = useQuery({
    queryKey: ["/api/customers"],
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/jobs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Job Created",
        description: "Your job has been created successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create job. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!jobData.address || !jobData.customerId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Combine date and time for appointment
    const appointmentDateTime = jobData.appointmentDate && jobData.appointmentTime 
      ? new Date(`${jobData.appointmentDate}T${jobData.appointmentTime}`)
      : null;

    const dueDateValue = jobData.dueDate ? new Date(jobData.dueDate) : null;

    createJobMutation.mutate({
      ...jobData,
      appointmentDate: appointmentDateTime,
      dueDate: dueDateValue,
      totalValue: jobData.totalValue || "0"
    });
  };

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-rpp-grey-border">
          <div>
            <h2 className="text-xl font-semibold text-rpp-grey-dark">New Job</h2>
            <p className="text-sm text-rpp-grey-light mt-1">
              Create a job for any customer, specifying a location, optional appointment(s), and order details.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-rpp-grey-light" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-rpp-grey-border">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-rpp-red-main' : 'text-rpp-grey-light'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                step >= 1 ? 'bg-rpp-red-main text-white' : 'bg-rpp-grey-border text-rpp-grey-light'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Job Information</span>
            </div>
            <div className="flex-1 h-px bg-rpp-grey-border"></div>
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-rpp-red-main' : 'text-rpp-grey-light'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                step >= 2 ? 'bg-rpp-red-main text-white' : 'bg-rpp-grey-border text-rpp-grey-light'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Appointment Details</span>
            </div>
            <div className="flex-1 h-px bg-rpp-grey-border"></div>
            <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-rpp-red-main' : 'text-rpp-grey-light'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                step >= 3 ? 'bg-rpp-red-main text-white' : 'bg-rpp-grey-border text-rpp-grey-light'
              }`}>
                3
              </div>
              <span className="text-sm font-medium">Order Summary</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-rpp-grey-dark mb-4 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Customer
                </h3>
                <Select value={jobData.customerId} onValueChange={(value) => setJobData(prev => ({ ...prev, customerId: value }))}>
                  <SelectTrigger className="border-rpp-grey-border">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer: any) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.firstName} {customer.lastName} - {customer.company || 'No company'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="mt-2 text-sm border-rpp-grey-border">
                  Create New Customer
                </Button>
              </div>

              <div>
                <h3 className="font-medium text-rpp-grey-dark mb-4 flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Location
                </h3>
                <Input
                  placeholder="Start typing to find a location"
                  value={jobData.address}
                  onChange={(e) => setJobData(prev => ({ ...prev, address: e.target.value }))}
                  className="border-rpp-grey-border"
                />
                <p className="text-xs text-rpp-grey-light mt-1">
                  Address went wrong? Enter manually
                </p>
                
                {/* Mock Map Area */}
                <div className="mt-4 h-48 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg flex items-center justify-center border border-rpp-grey-border">
                  <div className="text-center text-rpp-grey-light">
                    <MapPin className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">Map will appear here</p>
                    <p className="text-xs">Interactive location selection</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-rpp-grey-dark mb-4 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Appointment
                </h3>
                <p className="text-sm text-rpp-grey-light mb-4">
                  Schedule one or multiple service visit appointments for this job.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                      Select a day
                    </label>
                    <Input
                      type="date"
                      value={jobData.appointmentDate}
                      onChange={(e) => setJobData(prev => ({ ...prev, appointmentDate: e.target.value }))}
                      className="border-rpp-grey-border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                      Set a start time
                    </label>
                    <Input
                      type="time"
                      value={jobData.appointmentTime}
                      onChange={(e) => setJobData(prev => ({ ...prev, appointmentTime: e.target.value }))}
                      className="border-rpp-grey-border"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={jobData.dueDate}
                    onChange={(e) => setJobData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="border-rpp-grey-border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                    Write appointment notes
                  </label>
                  <Textarea
                    placeholder="Visible to you and your team only"
                    value={jobData.notes}
                    onChange={(e) => setJobData(prev => ({ ...prev, notes: e.target.value }))}
                    className="border-rpp-grey-border min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-rpp-grey-dark mb-4 flex items-center">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Order Summary
                </h3>
                
                <Card className="border-rpp-grey-border">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-rpp-grey-light">Customer:</span>
                        <span className="text-sm text-rpp-grey-dark">
                          {customers.find((c: any) => c.id === jobData.customerId)?.firstName || 'N/A'} {customers.find((c: any) => c.id === jobData.customerId)?.lastName || ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-rpp-grey-light">Location:</span>
                        <span className="text-sm text-rpp-grey-dark">{jobData.address || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-rpp-grey-light">Appointment:</span>
                        <span className="text-sm text-rpp-grey-dark">
                          {jobData.appointmentDate && jobData.appointmentTime 
                            ? `${jobData.appointmentDate} at ${jobData.appointmentTime}`
                            : 'Not scheduled'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-rpp-grey-light">Due Date:</span>
                        <span className="text-sm text-rpp-grey-dark">{jobData.dueDate || 'Not set'}</span>
                      </div>
                      <hr className="border-rpp-grey-border" />
                      <div>
                        <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                          Total Value (optional)
                        </label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={jobData.totalValue}
                          onChange={(e) => setJobData(prev => ({ ...prev, totalValue: e.target.value }))}
                          className="border-rpp-grey-border"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="sendEmail" className="rounded border-rpp-grey-border" />
                  <label htmlFor="sendEmail" className="text-sm text-rpp-grey-dark">
                    Send customer confirmation email
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-6 border-t border-rpp-grey-border">
          <div className="flex space-x-2">
            {step > 1 && (
              <Button variant="outline" onClick={prevStep} className="border-rpp-grey-border">
                Back
              </Button>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button variant="ghost" onClick={onClose} className="text-rpp-red-main hover:text-rpp-red-dark">
              Cancel
            </Button>
            {step < 3 ? (
              <Button onClick={nextStep} className="bg-rpp-red-main hover:bg-rpp-red-dark text-white">
                Continue
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={createJobMutation.isPending}
                className="bg-rpp-red-main hover:bg-rpp-red-dark text-white"
              >
                {createJobMutation.isPending ? "Creating..." : "Create Job"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
