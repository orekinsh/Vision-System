#include "cv.h"
#include "highgui.h"
#include <stdio.h>

enum {RED , GREEN ,ORANGE ,YELLOW ,BLUE , BLACK ,WHITE };

typedef struct Min_Max_
{

    int R_Max;
    int R_Min;
    int G_Max;
    int G_Min;
    int B_Max;
    int B_Min;

} Min_Max;

class ColorDetector
{
    Min_Max color[7];

    public:

    ColorDetector()
    {
        FILE* file = fopen("color.bin","rb+");
        for(int i=0; i<7; i++)
            fread(&color[i], sizeof(Min_Max), 1, file);
        fclose(file);
    }        
    
    void find_connected_components(IplImage *mask) 
    {
    	static CvMemStorage* mem_storage = NULL;
    	static CvSeq* contours= NULL;
    
    	//CLEAN UP RAW MASK
    	cvMorphologyEx( mask, mask, 0, 0, CV_MOP_OPEN,1 );
    	cvMorphologyEx( mask, mask, 0, 0, CV_MOP_CLOSE,1 );
        
    	//FIND CONTOURS AROUND ONLY BIGGER REGIONS
    	if( mem_storage==NULL ) 
    		mem_storage = cvCreateMemStorage(0);
       	else 
    		cvClearMemStorage(mem_storage);
    
       	CvContourScanner scanner = cvStartFindContours(mask,mem_storage,sizeof(CvContour),CV_RETR_EXTERNAL,CV_CHAIN_APPROX_SIMPLE);
    	CvSeq* c;
    	int numCont = 0;
    
       	while( (c = cvFindNextContour( scanner )) != NULL ) 
    	{
    		double len = cvContourPerimeter( c );
    		double q = (mask->height + mask->width)/20.0;
       		if( len < q ) 
    		{
    			cvSubstituteContour( scanner, NULL );
    		} 
       		else 
    		{
    			CvSeq* c_new;
    			c_new = cvApproxPoly(c,sizeof(CvContour),mem_storage,CV_POLY_APPROX_DP,2,0);
    			cvSubstituteContour( scanner, c_new );
    			numCont++;
    		}
    	}
    	contours = cvEndFindContours( &scanner );
        
    	// PAINT THE FOUND REGIONS BACK INTO THE IMAGE
    	const CvScalar CVX_WHITE = CV_RGB(0xff,0xff,0xff);
    	const CvScalar CVX_BLACK = CV_RGB(0x00,0x00,0x00);
    	cvZero( mask );
    
    	for( c=contours; c != NULL; c = c->h_next ) 
    		cvDrawContours(mask,c,CVX_WHITE,CVX_BLACK,-1,CV_FILLED,8);
    }
        
    IplImage* color_detect(IplImage* Frame,int Flag) 
    {
        IplImage* Processed = cvCreateImage(cvGetSize(Frame),8,1);
        int x,y;
        uchar *ptrp=(uchar*)Processed->imageData;
        uchar *ptr=(uchar*)Frame->imageData; 
        
        for(y=0;y<Frame->height;y++)
        {
      	    for(x=0;x<Frame->width;x++)
    		{
    		    if((color[Flag].R_Max<ptr[3*x]) && (ptr[3*x]<color[Flag].R_Max) && (color[Flag].G_Min<ptr[3*x+1]) && (ptr[3*x+1]<color[Flag].G_Max) & (color[Flag].B_Min<ptr[3*x+2]) && (ptr[3*x+2]<color[Flag].B_Min))
    		        ptrp[3*x] = 255;
       		    else
    		        ptrp[3*x] = 0;
    		    ptrp++;
    		    ptr+=3;
    		}
    	}
        
        find_connected_components(Processed);
        return Processed;
    }
    
}       
