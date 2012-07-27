#include <stdio.h>
#include "cv.h"
#include "highgui.h"
#include "color_calib.cpp"

int main(int argc, char** argv)
{
    
    ColorCalibrator calib;
    int i=0;
    
    for(i=1; i<argc; i++)
    {
        IplImage* image = cvLoadImage(argv[i], 1);
        calib.show_ui(image);
        cvReleaseImage(&image);
    }
    
    calib.write_back();
    
    return 0;
}
