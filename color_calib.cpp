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

IplImage* imagen;
int red,green,blue;
IplImage* screenBuffer;
int drawing;
int r,last_x, last_y;
CvRect rect;

void draw(int x, int y) {
	rect.width = x-last_x;
	rect.height = y-last_y;
	cvCopy(imagen,screenBuffer);	
	cvRectangle(screenBuffer, cvPoint(last_x,last_y), cvPoint(x,y), CV_RGB(255,0,0),1);
	cvShowImage( "color calibration", screenBuffer );
}

void on_mouse( int event, int x, int y, int flags, void* param )
{
	if(event==CV_EVENT_LBUTTONDOWN)
    {
		last_x = x;
		last_y = y;
		rect.width = x-last_x;
		rect.height = y-last_y;
		rect.x = last_x;
		rect.y = last_y;
		drawing = 1;
	}
    else if(event==CV_EVENT_LBUTTONUP)
	{
		if(drawing)			//drawing=!drawing;
		{
		    drawing = 0;
		    rect.width = x-last_x;
		    rect.height = y-last_y;
		}
	}
	else if(event == CV_EVENT_MOUSEMOVE  &&  flags & CV_EVENT_FLAG_LBUTTON)
	{
		if(drawing)
			draw(x,y);
	}
}

class ColorCalibrator
{
    Min_Max color[7];

    public:

    ColorDetector()
    {
        Min_Max def;
        def.R_max = 0; def.R_min = 255; def.G_max = 0; def.G_min = 255; def.B_max = 0; def.B_min = 255;
        FILE* file = fopen("color.bin","rb+");
        for(int i=0; i<7; i++)
        {
            if(fread(&color[i], sizeof(Min_Max), 1, file)<=0)
            {
                for(i=0; i<7; i++)
                    color[i] = def;
                break;
            }
        }
        fclose(file);
    }        
    
    void set_range(IplImage* Frame,int Flag) 
    {
        int x,y;
        uchar *ptr=(uchar*)Frame->imageData; 
        
        for(y=0;y<Frame->height;y++)
        {
      	    for(x=0;x<Frame->width;x++)
    		{
    		    if(color[Flag].R_Max<ptr[3*x])
    		        color[Flag].R_Max = ptr[3*x];
    		    if(ptr[3*x]<color[Flag].R_Min)
    		        color[Flag].R_Min = ptr[3*x];
    		    if(color[Flag].G_Max<ptr[3*x+1])
    		        color[Flag].G_Max = ptr[3*x+1];
    		    if(ptr[3*x+1]<color[Flag].G_Min)
    		        color[Flag].G_Min = ptr[3*x+1];
    		    if(color[Flag].B_Max<ptr[3*x+2])
    		        color[Flag].B_Max = ptr[3*x+2];
    		    if(ptr[3*x+2]<color[Flag].B_Min)
    		        color[Flag].B_Min = ptr[3*x+2];

    		    ptr+=3;
    		}
    	}
        
    }
    
    void write_back()
    {
        int x;
        FILE* file = fopen("color.bin", "wb+");
        for(x=0; x<7; x++)
            fwrite(&color[x], siizeof(Min_Max), 1, file);
        fclose(file);
    }  

    void show_ui(IplImage* image)
    {
        cvNamedWindow("color calibration");
    	drawing = 0;
    	last_x=last_y=red=green=blue=0;
    
    	printf("Instructions:\n  q--reset\n  r--red\n  g--green\n  b--black\n  o--orange\n  y--yellow\n");
    
    	imagen = cvCloneImage(image);
    	screenBuffer = cvCloneImage(imagen);
    	cvCopy(imagen,screenBuffer);
    	cvSetMouseCallback("color calibration",&on_mouse, 0 );
	    char c;	

       	while(1)
        {
	        cvShowImage( "color calibration", screenBuffer );
	        c = cvWaitKey(10);
	        if( c == 27 )
	            break;
            else
            {
        		switch(c)
        		{
        		    case 'q':
                        cvCopy(imagen,screenBuffer);
	    		        c='\0';
	    		        break;
                    case 'r':
                        cvSetImageROI(imagen, rect);
                        set_range(imagen, RED);
                        cvResetImageROI(imagen);
	    		        c='\0';
                        break;
                    case 'g':
                        cvSetImageROI(imagen, rect);
                        set_range(imagen, GREEN);
                        cvResetImageROI(imagen);
	    		        c='\0';
                        break;
                    case 'b':
                        cvSetImageROI(imagen, rect);
                        set_range(imagen, BLACK);
                        cvResetImageROI(imagen);
	    		        c='\0';
                        break;
                    case 'o':
                        cvSetImageROI(imagen, rect);
                        set_range(imagen, ORANGE);
                        cvResetImageROI(imagen);
	    		        c='\0';
                        break;
                    case 'w':
                        cvSetImageROI(imagen, rect);
                        set_range(imagen, WHITE);
                        cvResetImageROI(imagen);
	    		        c='\0';
                        break;
        		}	
	        }
	    }
        
        cvDestroyWindow("color calibration");
        
    }
        
}       
