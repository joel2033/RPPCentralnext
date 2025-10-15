import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Search, Phone, Mail, Building2, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

export default function CustomerProfile() {
  const [, params] = useRoute("/customers/:id");
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: customer } = useQuery<any>({
    queryKey: [`/api/customers/${params?.id}/profile`],
  });

  if (!customer) {
    return <div className="p-6">Loading...</div>;
  }

  const stats = [
    { label: "Total Sales", value: `$${customer.totalValue || 0}`, color: "text-rpp-red-main" },
    { label: "Average Job Value", value: `$${customer.averageJobValue || 0}`, color: "text-rpp-red-main" },
    { label: "Jobs Completed", value: customer.jobsCompleted || 0, color: "text-rpp-grey-dark" },
  ];

  const jobsList = [
    {
      id: 1,
      address: "16 Collins Street, Plumpton NSW 6018 2761",
      date: "Aug 07, 2025",
      dueDate: "Due Aug 09",
      status: "Completed",
      statusColor: "bg-green-50 text-support-green border-support-green",
      price: "$380.00"
    },
    {
      id: 2,
      address: "42 Martin Place, Sydney NSW 2000",
      date: "Aug 10, 2025",
      dueDate: "Due Aug 12",
      status: "In Progress",
      statusColor: "bg-yellow-50 text-support-yellow border-support-yellow",
      price: "$520.00"
    },
    {
      id: 3,
      address: "18 Beach Road, Bondi NSW 2026",
      date: "Aug 14, 2025",
      dueDate: "Due Aug 16",
      status: "Scheduled",
      statusColor: "bg-blue-50 text-support-blue border-support-blue",
      price: "$450.00"
    }
  ];

  const initials = customer.firstName && customer.lastName 
    ? `${customer.firstName[0]}${customer.lastName[0]}`.toUpperCase()
    : "NA";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/customers")}
              className="text-rpp-grey-medium hover:text-rpp-grey-dark"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-rpp-grey-dark">
                {customer.firstName} {customer.lastName}
              </h1>
              <p className="text-sm text-rpp-grey-medium">Customer Profile</p>
            </div>
          </div>
          <Button 
            className="bg-rpp-red-main hover:bg-rpp-red-dark text-white rounded-full px-6"
            onClick={() => setLocation("/jobs/new")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create new job
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="bg-white border-0 rounded-2xl shadow-sm">
              <CardContent className="p-6 text-center">
                <div className={`text-3xl font-bold ${stat.color} mb-1`}>
                  {stat.value}
                </div>
                <div className="text-sm text-rpp-grey-medium">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Jobs Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white border border-gray-100 rounded-3xl shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-rpp-grey-dark mb-1">Jobs</h2>
                    <p className="text-sm text-rpp-grey-medium">
                      Easily access and manage upcoming and delivered jobs for this customer.
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="text-rpp-red-main hover:bg-rpp-red-lighter text-sm font-semibold"
                    onClick={() => setLocation("/jobs/new")}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create new job
                  </Button>
                </div>

                {/* Search and Filters */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rpp-grey-medium" />
                    <Input
                      type="text"
                      placeholder="Search jobs by address..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-gray-200 rounded-lg bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <Button variant="outline" className="border-gray-200 rounded-lg text-rpp-grey-dark bg-white hover:bg-gray-50">
                    All Status
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                  <Button variant="outline" className="border-gray-200 rounded-lg text-rpp-grey-dark bg-white hover:bg-gray-50">
                    Filters
                  </Button>
                </div>

                {/* Jobs List */}
                <div className="space-y-3">
                  {jobsList.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer border border-transparent hover:border-gray-200"
                    >
                      <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-rpp-red-main"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-rpp-grey-dark mb-1">{job.address}</p>
                        <p className="text-sm text-rpp-grey-medium">
                          {job.date} • {job.dueDate}
                        </p>
                      </div>
                      <Badge className={`${job.statusColor} border rounded-full px-3 py-1 text-xs font-semibold`}>
                        {job.status}
                      </Badge>
                      <div className="text-lg font-bold text-rpp-grey-dark">
                        {job.price}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Details Sidebar */}
          <div className="space-y-6">
            <Card className="bg-white border-0 rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-rpp-grey-dark mb-6">Customer Details</h3>

                {/* Avatar and Name */}
                <div className="flex flex-col items-center mb-6">
                  <div className="w-20 h-20 rounded-full bg-rpp-red-main flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-white">{initials}</span>
                  </div>
                  <h4 className="text-lg font-bold text-rpp-grey-dark">
                    {customer.firstName} {customer.lastName}
                  </h4>
                  <p className="text-sm text-rpp-grey-medium">{customer.company || 'Wilson Photography Co.'}</p>
                </div>

                {/* Contact Information */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-rpp-grey-medium mt-1" />
                    <div>
                      <p className="text-xs text-rpp-grey-medium mb-1">Email</p>
                      <p className="text-sm text-rpp-grey-dark">{customer.email || 'emma.wilson@example.com'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-rpp-grey-medium mt-1" />
                    <div>
                      <p className="text-xs text-rpp-grey-medium mb-1">Phone</p>
                      <p className="text-sm text-rpp-grey-dark">{customer.phone || '+61 488 765 432'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-rpp-grey-medium mt-1" />
                    <div>
                      <p className="text-xs text-rpp-grey-medium mb-1">Company</p>
                      <p className="text-sm text-rpp-grey-dark">{customer.company || 'Wilson Photography Co.'}</p>
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div className="mb-6">
                  <p className="text-xs text-rpp-grey-medium mb-2">Category</p>
                  <Badge className="bg-rpp-grey-bg text-rpp-grey-dark border-0 rounded-lg px-3 py-1">
                    residential
                  </Badge>
                </div>

                {/* Customer Notes */}
                <div className="mb-6">
                  <p className="text-xs text-rpp-grey-medium mb-2">Customer notes</p>
                  <p className="text-sm text-rpp-grey-light italic">No category</p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full border-rpp-grey-border text-rpp-grey-dark hover:bg-rpp-grey-bg rounded-lg"
                  >
                    Edit Customer
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full border-rpp-grey-border text-rpp-grey-dark hover:bg-rpp-grey-bg rounded-lg"
                  >
                    Delete Customer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}