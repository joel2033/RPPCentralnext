import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload as UploadIcon, FileImage, X } from "lucide-react";

export default function Upload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [orderDetails, setOrderDetails] = useState({
    title: "",
    supplier: "",
    service: "",
    quantity: "",
    instructions: "",
    exportSpecs: ""
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-rpp-grey-dark">Upload to Editor</h2>
        <p className="text-rpp-grey-light">Upload your photos and provide editing instructions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Information */}
          <Card className="border-rpp-grey-border">
            <CardHeader>
              <CardTitle className="text-rpp-grey-dark">New Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Name
                </label>
                <Input
                  placeholder="Enter the name for your respective experience"
                  value={orderDetails.title}
                  onChange={(e) => setOrderDetails(prev => ({ ...prev, title: e.target.value }))}
                  className="border-rpp-grey-border"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Supplier
                </label>
                <Input
                  placeholder="Choose from the list dependant on the order type: Learn more about assigning suppliers here"
                  value={orderDetails.supplier}
                  onChange={(e) => setOrderDetails(prev => ({ ...prev, supplier: e.target.value }))}
                  className="border-rpp-grey-border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Service
                </label>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Choose the service (or application) for this order"
                    value={orderDetails.service}
                    onChange={(e) => setOrderDetails(prev => ({ ...prev, service: e.target.value }))}
                    className="border-rpp-grey-border flex-1"
                  />
                  <Button variant="outline" className="border-rpp-grey-border">
                    Image Enhancement - Basic
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Quantity
                </label>
                <Input
                  placeholder="The total quantity as relevant to your edit suppliers choice above (eg: charges per each, photo, hour, etc)"
                  value={orderDetails.quantity}
                  onChange={(e) => setOrderDetails(prev => ({ ...prev, quantity: e.target.value }))}
                  className="border-rpp-grey-border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Instructions
                </label>
                <Textarea
                  placeholder="Use detailed specificity to convey to your supplier about the expected results for this service."
                  value={orderDetails.instructions}
                  onChange={(e) => setOrderDetails(prev => ({ ...prev, instructions: e.target.value }))}
                  className="border-rpp-grey-border min-h-[100px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-rpp-grey-dark mb-2">
                  Export Specs
                </label>
                <Textarea
                  placeholder="Specify output requirements for your editor, such as: size, resolution, format, and any other requirements"
                  value={orderDetails.exportSpecs}
                  onChange={(e) => setOrderDetails(prev => ({ ...prev, exportSpecs: e.target.value }))}
                  className="border-rpp-grey-border min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card className="border-rpp-grey-border">
            <CardHeader>
              <CardTitle className="text-rpp-grey-dark">Upload Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-rpp-grey-border rounded-lg p-8 text-center hover:border-rpp-red-main transition-colors"
              >
                <UploadIcon className="w-12 h-12 text-rpp-grey-light mx-auto mb-4" />
                <p className="text-rpp-grey-dark font-medium mb-2">
                  Drag and drop your files here, or click to browse
                </p>
                <p className="text-sm text-rpp-grey-light mb-4">
                  Supported formats: JPG, PNG, RAW, TIFF (Max 100MB per file)
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" className="border-rpp-grey-border">
                    Choose Files
                  </Button>
                </label>
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-rpp-grey-dark mb-3">
                    Selected Files ({selectedFiles.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-rpp-grey-border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <FileImage className="w-5 h-5 text-rpp-grey-light" />
                          <div>
                            <p className="text-sm font-medium text-rpp-grey-dark">{file.name}</p>
                            <p className="text-xs text-rpp-grey-light">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-rpp-grey-light hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <div>
          <Card className="border-rpp-grey-border sticky top-24">
            <CardHeader>
              <CardTitle className="text-rpp-grey-dark">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-rpp-grey-light">Service:</span>
                  <span className="text-rpp-grey-dark">Image Enhancement - Basic</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-rpp-grey-light">Quantity:</span>
                  <span className="text-rpp-grey-dark">{selectedFiles.length} files</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-rpp-grey-light">Rate:</span>
                  <span className="text-rpp-grey-dark">$2.50 per image</span>
                </div>
                <hr className="border-rpp-grey-border" />
                <div className="flex justify-between font-medium">
                  <span className="text-rpp-grey-dark">Total (estimated):</span>
                  <span className="text-rpp-grey-dark">
                    ${(selectedFiles.length * 2.5).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  className="w-full bg-rpp-red-main hover:bg-rpp-red-dark text-white"
                  disabled={selectedFiles.length === 0}
                >
                  Submit Order
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-rpp-grey-border text-rpp-grey-dark"
                >
                  Save as Draft
                </Button>
              </div>

              <div className="pt-4 text-xs text-rpp-grey-light">
                <p>
                  By submitting this order, you agree to our{" "}
                  <a href="#" className="text-rpp-red-main hover:underline">
                    terms of service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-rpp-red-main hover:underline">
                    editing guidelines
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
