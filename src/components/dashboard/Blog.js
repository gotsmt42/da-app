import {
  Card,
  CardBody,
  CardImg,
  CardSubtitle,
  CardText,
  CardTitle,
  Button,
} from "reactstrap";
import { Link } from "react-router-dom";

const Blog = (props) => {
  const Icon = props.icon;

  return (
    <Link to={props.link} style={{ textDecoration: "none", color: "inherit" }}>
       <Card className="mb-4" style={{ border: '1px solid #e3e3e3', borderRadius: '10px' }}>
        <div className="icon-container" style={{ textAlign: 'center', padding: '20px', backgroundColor: props.iconBgColor || '#f8f9fa' }}>
          <Icon size={props.iconSize || 50} color={props.iconColor || '#000'} />
        </div>
        <CardBody className="p-4">
          <CardTitle tag="h5">{props.title}</CardTitle>
          <CardSubtitle>{props.subtitle}</CardSubtitle>
          <CardText className="mt-3">{props.text}</CardText>
          {/* <Button color={props.color}>Read More</Button> */}
        </CardBody>
      </Card>
    </Link>
  );
};

export default Blog;
